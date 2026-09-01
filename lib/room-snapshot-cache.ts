type MemoryEntry={value:unknown;expiresAt:number;generation:number};
type CacheStorageWithDefault=CacheStorage&{default?:Cache};

const VERSION="gold-v2-1";
const MAX_MEMORY_ENTRIES=512;
const memory=new Map<string,MemoryEntry>();
const inFlight=new Map<string,Promise<unknown>>();
const generations=new Map<string,number>();

function key(namespace:string,meetingId:string){
  return `${VERSION}:${namespace}:${meetingId}`;
}

function cacheRequest(cacheKey:string){
  return new Request(`https://smartlingo-room-cache.invalid/${encodeURIComponent(cacheKey)}`);
}

function sharedCache(){
  return (globalThis.caches as CacheStorageWithDefault|undefined)?.default;
}

function generation(cacheKey:string){
  return generations.get(cacheKey)||0;
}

function remember(cacheKey:string,value:unknown,expiresAt:number,operationGeneration:number){
  const now=Date.now();
  if(memory.size>=MAX_MEMORY_ENTRIES)
    for(const [entryKey,entry] of memory){
      if(entry.expiresAt<=now||memory.size>=MAX_MEMORY_ENTRIES)
        memory.delete(entryKey);
      if(memory.size<MAX_MEMORY_ENTRIES)break;
    }
  memory.set(cacheKey,{value,expiresAt,generation:operationGeneration});
}

/**
 * Cache only room-common, already-authorized read models. Routes must perform
 * their normal access check before calling this helper and must append any
 * requester-specific fields after the cached loader resolves.
 */
export async function cachedRoomSnapshot<T>(
  namespace:string,
  meetingId:string,
  ttlMs:number,
  loader:()=>Promise<T>,
):Promise<T>{
  const cacheKey=key(namespace,meetingId);
  const now=Date.now();
  let operationGeneration=generation(cacheKey);
  const local=memory.get(cacheKey);
  if(local&&local.expiresAt>now&&local.generation===operationGeneration)return local.value as T;
  memory.delete(cacheKey);
  const pending=inFlight.get(cacheKey);
  if(pending)return pending as Promise<T>;
  const request=cacheRequest(cacheKey);
  const cache=sharedCache();
  if(cache){
    const response=await cache.match(request).catch(()=>undefined);
    if(response){
      const expiresAt=Number(response.headers.get("x-smartlingo-expires-at")||0);
      if(expiresAt>now&&operationGeneration===generation(cacheKey)){
        const value=await response.json() as T;
        if(operationGeneration!==generation(cacheKey))return cachedRoomSnapshot(namespace,meetingId,ttlMs,loader);
        remember(cacheKey,value,expiresAt,operationGeneration);
        return value;
      }
      if(operationGeneration!==generation(cacheKey))
        return cachedRoomSnapshot(namespace,meetingId,ttlMs,loader);
      await cache.delete(request).catch(()=>undefined);
    }
  }
  operationGeneration=generation(cacheKey);
  const work=(async()=>{
    const value=await loader();
    const expiresAt=Date.now()+Math.max(500,Math.min(10_000,Math.floor(ttlMs)));
    if(operationGeneration===generation(cacheKey)){
      if(cache)await cache.put(request,new Response(JSON.stringify(value),{headers:{
        "content-type":"application/json",
        "cache-control":`public, max-age=${Math.max(1,Math.ceil(ttlMs/1000))}`,
        "x-smartlingo-expires-at":String(expiresAt),
      }})).catch(()=>undefined);
      if(operationGeneration!==generation(cacheKey)){
        if(cache)await cache.delete(request).catch(()=>undefined);
        return value;
      }
      remember(cacheKey,value,expiresAt,operationGeneration);
    }
    return value;
  })();
  inFlight.set(cacheKey,work);
  try{return await work;}
  finally{if(inFlight.get(cacheKey)===work)inFlight.delete(cacheKey);}
}

export async function invalidateRoomSnapshot(namespace:string,meetingId:string){
  const cacheKey=key(namespace,meetingId);
  generations.set(cacheKey,generation(cacheKey)+1);
  memory.delete(cacheKey);
  inFlight.delete(cacheKey);
  const cache=sharedCache();
  if(cache)await cache.delete(cacheRequest(cacheKey)).catch(()=>undefined);
}
