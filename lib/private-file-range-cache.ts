type CacheStorageWithDefault=CacheStorage&{default?:Cache};
type RangeSource={body:BodyInit|null};

const CACHE_VERSION="gold-v2-1";
export const PRIVATE_FILE_RANGE_CACHE_SECONDS=10*60;

async function sha256(value:string){
  const digest=new Uint8Array(await crypto.subtle.digest(
    "SHA-256",new TextEncoder().encode(value),
  ));
  return Array.from(digest,byte=>byte.toString(16).padStart(2,"0")).join("");
}

function sharedCache(){
  return (globalThis.caches as CacheStorageWithDefault|undefined)?.default;
}

async function retainCacheWrite(promise:Promise<unknown>){
  const settled=promise.catch(()=>undefined);
  try{
    const{waitUntil}=await import("cloudflare:workers") as unknown as {
      waitUntil?:(promise:Promise<unknown>)=>void;
    };
    if(typeof waitUntil==="function"){
      waitUntil(settled);
      return;
    }
  }catch{
    // Unit tests and non-Worker runtimes do not expose the execution context.
  }
  await settled;
}

async function cacheRequest(
  namespace:string,
  objectKey:string,
  version:string,
  offset:number,
  length:number,
){
  // Neither R2 keys nor meeting/resource ids appear in the synthetic URL.
  // Authorization and bandwidth accounting always happen before this helper;
  // the Cache API is only an internal, per-zone R2 read-through cache.
  const digest=await sha256(`${namespace}\0${objectKey}\0${version}\0${offset}\0${length}`);
  return new Request(`https://smartlingo-private-range-cache.invalid/${CACHE_VERSION}/${digest}`);
}

export async function cachedPrivateFileSize(input:{
  namespace:string;
  objectKey:string;
  version:string;
  load:()=>Promise<number>;
}){
  const cache=sharedCache();
  const request=await cacheRequest(
    `${input.namespace}:size`,input.objectKey,input.version,0,0,
  );
  if(cache){
    const hit=await cache.match(request).catch(()=>undefined);
    if(hit){
      const size=Number(await hit.text());
      if(Number.isSafeInteger(size)&&size>0)return size;
      await cache.delete(request).catch(()=>undefined);
    }
  }
  const size=await input.load();
  if(!Number.isSafeInteger(size)||size<1)return 0;
  if(cache)await retainCacheWrite(cache.put(request,new Response(String(size),{headers:{
    "content-type":"text/plain",
    "cache-control":`public, max-age=${PRIVATE_FILE_RANGE_CACHE_SECONDS}`,
  }})));
  return size;
}

export async function cachedPrivateFileRange(input:{
  namespace:string;
  objectKey:string;
  version:string;
  offset:number;
  length:number;
  load:()=>Promise<RangeSource|null>;
}){
  const cache=sharedCache();
  const request=await cacheRequest(
    input.namespace,input.objectKey,input.version,input.offset,input.length,
  );
  if(cache){
    const hit=await cache.match(request).catch(()=>undefined);
    if(hit&&Number(hit.headers.get("content-length"))===input.length)return hit;
    if(hit)await cache.delete(request).catch(()=>undefined);
  }
  const source=await input.load();
  if(!source)return null;
  const response=new Response(source.body,{headers:{
    "content-length":String(input.length),
    "content-type":"application/octet-stream",
    "cache-control":`public, max-age=${PRIVATE_FILE_RANGE_CACHE_SECONDS}`,
    "x-smartlingo-private-range":"1",
  }});
  // Edge population must survive the request, but a cold large range must not
  // wait for the Cache API copy before its first byte can reach the member.
  if(cache)await retainCacheWrite(cache.put(request,response.clone()));
  return response;
}
