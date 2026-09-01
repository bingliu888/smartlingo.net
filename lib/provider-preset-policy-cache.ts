type CacheStorageWithDefault=CacheStorage&{default?:Cache};
type Entry={expiresAt:number};

export const PROVIDER_PRESET_POLICY_TTL_MS=5*60*1000;
const VERSION="gold-v2-1";
const MAX_MEMORY_ENTRIES=128;
const memory=new Map<string,Entry>();

function sharedCache(){return (globalThis.caches as CacheStorageWithDefault|undefined)?.default;}

async function digest(value:string){
  const bytes=new Uint8Array(await crypto.subtle.digest(
    "SHA-256",new TextEncoder().encode(value),
  ));
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function requestFor(key:string){
  return new Request(`https://smartlingo-preset-policy.invalid/${VERSION}/${await digest(key)}`);
}

function remember(key:string,expiresAt:number){
  const now=Date.now();
  for(const [candidate,entry] of memory)
    if(entry.expiresAt<=now||memory.size>=MAX_MEMORY_ENTRIES)memory.delete(candidate);
  memory.set(key,{expiresAt});
}

export async function providerPresetPolicyIsFresh(key:string,now=Date.now()){
  const local=memory.get(key);
  if(local?.expiresAt&&local.expiresAt>now)return true;
  memory.delete(key);
  const cache=sharedCache();
  if(!cache)return false;
  const request=await requestFor(key);
  const response=await cache.match(request).catch(()=>undefined);
  const expiresAt=Number(response?.headers.get("x-smartlingo-expires-at")||0);
  if(expiresAt>now){remember(key,expiresAt);return true;}
  if(response)await cache.delete(request).catch(()=>undefined);
  return false;
}

export async function rememberProviderPresetPolicy(key:string,now=Date.now()){
  const expiresAt=now+PROVIDER_PRESET_POLICY_TTL_MS;
  remember(key,expiresAt);
  const cache=sharedCache();
  if(cache)await cache.put(await requestFor(key),new Response("1",{headers:{
    "content-type":"text/plain",
    "cache-control":`public, max-age=${Math.ceil(PROVIDER_PRESET_POLICY_TTL_MS/1000)}`,
    "x-smartlingo-expires-at":String(expiresAt),
  }})).catch(()=>undefined);
}

export function resetProviderPresetPolicyCacheForTests(){memory.clear();}
