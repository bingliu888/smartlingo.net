export const DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS=12_000;
export const REALTIME_PROVIDER_REQUEST_TIMEOUT_MS=DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS;
export const STRIPE_REQUEST_TIMEOUT_MS=15_000;
export const BLOCKCHAIN_RPC_REQUEST_TIMEOUT_MS=10_000;
export const SOURCE_VERIFICATION_REQUEST_TIMEOUT_MS=15_000;
export const WEBHOOK_KEY_REQUEST_TIMEOUT_MS=10_000;
export const ARTIFACT_SOURCE_IDLE_TIMEOUT_MS=30_000;
export const ARTIFACT_SOURCE_TOTAL_TIMEOUT_MS=5*60*60*1000;
export const AI_TEXT_REQUEST_TIMEOUT_MS=20_000;
export const AI_IMAGE_REQUEST_TIMEOUT_MS=45_000;

export async function withExternalRequestTimeout<T>(
  operation:(signal:AbortSignal)=>Promise<T>,
  timeoutMs=DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS,
) {
  const controller=new AbortController();
  const bounded=Math.max(250,Math.min(120_000,Math.floor(timeoutMs)));
  const timer=setTimeout(()=>controller.abort(new Error("EXTERNAL_REQUEST_TIMEOUT")),bounded);
  try{return await operation(controller.signal);}
  catch(error){if(controller.signal.aborted)throw new Error("EXTERNAL_REQUEST_TIMEOUT");throw error;}
  finally{clearTimeout(timer);}
}

export async function readBoundedExternalResponseText(response:Response,maxBytes:number) {
  const limit=Math.max(1,Math.min(2*1024*1024,Math.floor(maxBytes)));
  const declared=Number(response.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>limit){await response.body?.cancel().catch(()=>undefined);return{text:"",truncated:true};}
  if(!response.body){
    const text=await response.text();
    const bytes=new TextEncoder().encode(text);
    return bytes.byteLength<=limit?{text,truncated:false}:{text:new TextDecoder().decode(bytes.slice(0,limit)),truncated:true};
  }
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,text="";
  try{
    while(true){
      const{done,value}=await reader.read();
      if(done){text+=decoder.decode();return{text,truncated:false};}
      if(!value)continue;
      const remaining=limit-size;
      if(value.byteLength>remaining){
        if(remaining>0)text+=decoder.decode(value.slice(0,remaining),{stream:true});
        await reader.cancel().catch(()=>undefined);
        return{text:text+decoder.decode(),truncated:true};
      }
      size+=value.byteLength;text+=decoder.decode(value,{stream:true});
    }
  }finally{reader.releaseLock();}
}

export async function withExternalRequestIdleTimeout<T>(
  operation:(signal:AbortSignal,touch:()=>void)=>Promise<T>,
  idleTimeoutMs=ARTIFACT_SOURCE_IDLE_TIMEOUT_MS,
  totalTimeoutMs=ARTIFACT_SOURCE_TOTAL_TIMEOUT_MS,
) {
  const controller=new AbortController();
  const bounded=Math.max(25,Math.min(120_000,Math.floor(idleTimeoutMs)));
  const totalBounded=Math.max(bounded,Math.min(6*60*60*1000,Math.floor(totalTimeoutMs)));
  let timer:ReturnType<typeof setTimeout>|undefined;
  let closed=false;
  let rejectIdle:(reason:Error)=>void=()=>undefined;
  const idle=new Promise<never>((_resolve,reject)=>{rejectIdle=reject;});
  const touch=()=>{
    if(closed)return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{const error=new Error("EXTERNAL_REQUEST_IDLE_TIMEOUT");controller.abort(error);rejectIdle(error);},bounded);
  };
  touch();
  const totalTimer=setTimeout(()=>{if(closed)return;const error=new Error("EXTERNAL_REQUEST_TOTAL_TIMEOUT");controller.abort(error);rejectIdle(error);},totalBounded);
  try{return await Promise.race([operation(controller.signal,touch),idle]);}
  catch(error){
    if(controller.signal.aborted){
      const reason=controller.signal.reason;
      throw new Error(reason instanceof Error&&reason.message==="EXTERNAL_REQUEST_TOTAL_TIMEOUT"?"EXTERNAL_REQUEST_TOTAL_TIMEOUT":"EXTERNAL_REQUEST_IDLE_TIMEOUT");
    }
    throw error;
  }finally{closed=true;if(timer)clearTimeout(timer);clearTimeout(totalTimer);}
}
