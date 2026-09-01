export async function boundedRequestBody(request:Request,maxBytes:number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("INVALID_REQUEST_BODY_LIMIT");
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new Response("Request body is too large",{status:413});
  if (!request.body) return new ArrayBuffer(0);
  const reader = request.body.getReader();
  const chunks:Uint8Array[] = [];
  let total = 0;
  while (true) {
    const {done,value} = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Response("Request body is too large",{status:413});
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk,offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

function invalidJsonBody() {
  return new Response("Request body must be a JSON object",{
    status:400,
    headers:{"cache-control":"no-store","content-type":"text/plain; charset=utf-8"},
  });
}

function parseJsonObject<T>(body:ArrayBuffer):T {
  let parsed:unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(body)); }
  catch { throw invalidJsonBody(); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw invalidJsonBody();
  return parsed as T;
}

export async function boundedJsonBody<T>(request:Request,maxBytes:number):Promise<T> {
  const body = await boundedRequestBody(request,maxBytes);
  if (!body.byteLength) throw invalidJsonBody();
  return parseJsonObject<T>(body);
}

export async function boundedOptionalJsonBody<T>(request:Request,maxBytes:number):Promise<T|null> {
  const body = await boundedRequestBody(request,maxBytes);
  return body.byteLength ? parseJsonObject<T>(body) : null;
}

export function boundedRequestStream(request:Request,maxBytes:number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("INVALID_REQUEST_BODY_LIMIT");
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new Response("Request body is too large",{status:413});
  if (!request.body) throw new Response("Request body is empty",{status:400});
  let received = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
    transform(chunk,controller) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        controller.error(new Response("Request body is too large",{status:413}));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
  return {body,declaredBytes:Number.isSafeInteger(declared)&&declared>0?declared:null,receivedBytes:()=>received};
}
