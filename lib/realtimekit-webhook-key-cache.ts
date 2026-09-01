import {
  readBoundedExternalResponseText,
  WEBHOOK_KEY_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "./external-request-timeout";
import { getDatabase } from "./auth";

type CacheStorageWithDefault=CacheStorage&{default?:Cache};
type RateLimitBinding={limit(input:{key:string}):Promise<{success:boolean}>};
type RuntimeEnvironment={REALTIMEKIT_WEBHOOK_KEY_FETCHES?:RateLimitBinding};

export const REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES=64*1024;
export const REALTIMEKIT_WEBHOOK_KEY_MAX_PEM_BYTES=8*1024;
export const REALTIMEKIT_WEBHOOK_KEY_TTL_MS=5*60*1000;
const CACHE_VERSION="gold-v2-1";
const CACHE_URL=`https://smartlingo-realtimekit-webhook-key.invalid/${CACHE_VERSION}/current`;
const MAX_SCHEMA_KEYS=8;

type PublicKeyEntry={pem:string;fetchedAt:number;expiresAt:number};
let memoryEntry:PublicKeyEntry|null=null;
let entryPromise:Promise<PublicKeyEntry>|null=null;
let importedKeyPromise:Promise<{key:CryptoKey;pem:string;expiresAt:number}>|null=null;

function sharedCache(){return(globalThis.caches as CacheStorageWithDefault|undefined)?.default;}
function cacheRequest(){return new Request(CACHE_URL);}

function byteLength(value:string){return new TextEncoder().encode(value).byteLength;}

function plainRecord(value:unknown):value is Record<string,unknown>{
  return Boolean(value&&typeof value==="object"&&!Array.isArray(value));
}

function normalizedPem(value:unknown){
  if(typeof value!=="string")return null;
  const pem=value.replace(/\r\n?/g,"\n").trim();
  if(byteLength(pem)<128||byteLength(pem)>REALTIMEKIT_WEBHOOK_KEY_MAX_PEM_BYTES)
    return null;
  if(!pem.startsWith("-----BEGIN PUBLIC KEY-----")
    ||!pem.endsWith("-----END PUBLIC KEY-----"))return null;
  const encoded=pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,"");
  if(encoded.length<128||encoded.length>REALTIMEKIT_WEBHOOK_KEY_MAX_PEM_BYTES
    ||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return null;
  return pem;
}

/**
 * RealtimeKit currently publishes one PEM in a small JSON document. Accept
 * the documented legacy spellings, but reject ambiguous or deeply/widely
 * shaped documents before anything reaches WebCrypto or the shared cache.
 */
export function parseRealtimeKitWebhookPublicKeyDocument(text:string){
  if(byteLength(text)>REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES)
    throw new Error("REALTIME_WEBHOOK_KEY_RESPONSE_TOO_LARGE");
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{throw new Error("REALTIME_WEBHOOK_KEY_INVALID_JSON");}
  if(!plainRecord(parsed)||Object.keys(parsed).length>MAX_SCHEMA_KEYS)
    throw new Error("REALTIME_WEBHOOK_KEY_INVALID_SCHEMA");
  const data=parsed.data;
  if(data!==undefined&&(!plainRecord(data)||Object.keys(data).length>MAX_SCHEMA_KEYS))
    throw new Error("REALTIME_WEBHOOK_KEY_INVALID_SCHEMA");
  const candidates=[
    parsed.public_key,parsed.publicKey,
    plainRecord(data)?data.public_key:undefined,
    plainRecord(data)?data.publicKey:undefined,
  ].filter(value=>value!==undefined);
  if(candidates.length<1||candidates.length>4)
    throw new Error("REALTIME_WEBHOOK_KEY_INVALID_SCHEMA");
  const normalized=candidates.map(normalizedPem);
  if(normalized.some(value=>!value))throw new Error("REALTIME_WEBHOOK_KEY_INVALID_PEM");
  const unique=new Set(normalized as string[]);
  if(unique.size!==1)throw new Error("REALTIME_WEBHOOK_KEY_AMBIGUOUS");
  return normalized[0] as string;
}

function normalizeCacheEntry(value:unknown,now:number):PublicKeyEntry|null{
  if(!plainRecord(value)||Object.keys(value).length!==3)return null;
  const pem=normalizedPem(value.pem);
  const fetchedAt=Number(value.fetchedAt);
  const expiresAt=Number(value.expiresAt);
  if(!pem||!Number.isSafeInteger(fetchedAt)||!Number.isSafeInteger(expiresAt)
    ||fetchedAt<=0||fetchedAt>now+5_000||expiresAt<=now||expiresAt<=fetchedAt
    ||expiresAt>fetchedAt+REALTIMEKIT_WEBHOOK_KEY_TTL_MS+5_000)return null;
  return{pem,fetchedAt,expiresAt};
}

async function readSharedEntry(cache:Cache,now:number){
  const request=cacheRequest();
  const response=await cache.match(request).catch(()=>undefined);
  if(!response)return null;
  const contentType=String(response.headers.get("content-type")||"").toLowerCase();
  const declared=Number(response.headers.get("content-length")||0);
  if(!contentType.startsWith("application/json")
    ||(Number.isFinite(declared)&&declared>REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES)){
    await cache.delete(request).catch(()=>undefined);return null;
  }
  const bounded=await readBoundedExternalResponseText(
    response,REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES,
  ).catch(()=>({text:"",truncated:true}));
  if(bounded.truncated){await cache.delete(request).catch(()=>undefined);return null;}
  let parsed:unknown;
  try{parsed=JSON.parse(bounded.text);}catch{
    await cache.delete(request).catch(()=>undefined);return null;
  }
  const entry=normalizeCacheEntry(parsed,now);
  if(!entry)await cache.delete(request).catch(()=>undefined);
  return entry;
}

async function persistSharedEntry(cache:Cache,entry:PublicKeyEntry,now:number){
  const body=JSON.stringify(entry);
  if(byteLength(body)>REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES)return;
  await cache.put(cacheRequest(),new Response(body,{headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":`public, max-age=${Math.max(1,Math.ceil((entry.expiresAt-now)/1000))}`,
  }})).catch(()=>undefined);
}

async function runtimeEnvironment(runtime?:RuntimeEnvironment){
  if(runtime)return runtime;
  const{env}=await import("cloudflare:workers");
  return env as unknown as RuntimeEnvironment;
}

async function keyFetchGuard(request:Request,runtime?:RuntimeEnvironment){
  const address=request.headers.get("cf-connecting-ip")?.trim();
  const limiter=(await runtimeEnvironment(runtime)).REALTIMEKIT_WEBHOOK_KEY_FETCHES;
  if(!address)throw new Response(
    "Webhook verification is temporarily unavailable",{
      status:503,headers:{"retry-after":"30","cache-control":"no-store"},
    },
  );
  // A constant key bounds a distributed cold-cache stampede. This guard runs
  // only after both isolate memory and Cache API miss, never on normal signed
  // webhook deliveries.
  if(limiter&&!(await limiter.limit({key:"realtimekit-webhook-key-fetch:v1"})).success)
    throw new Response("Webhook verification is busy",{
      status:429,headers:{"retry-after":"10","cache-control":"no-store"},
    });
  if(!limiter){
    const now=Math.floor(Date.now()/1000),scope="realtimekit-webhook-key-fetch";
    const state=await getDatabase().prepare(`INSERT INTO account_request_limits(
      scope,actor_key,window_started_at,request_count,blocked_until,updated_at
    ) VALUES(?,'global',?,1,0,?) ON CONFLICT(scope,actor_key) DO UPDATE SET
      window_started_at=CASE WHEN window_started_at<=? THEN excluded.window_started_at ELSE window_started_at END,
      request_count=CASE WHEN window_started_at<=? THEN 1 ELSE request_count+1 END,
      blocked_until=CASE WHEN window_started_at>? AND request_count>=119 THEN ? ELSE 0 END,
      updated_at=excluded.updated_at RETURNING blocked_until AS blockedUntil`)
      .bind(scope,now,now,now-60,now-60,now-60,now+60)
      .first<{blockedUntil:number}>();
    if(state?.blockedUntil&&state.blockedUntil>now)
      throw new Response("Webhook verification is busy",{
        status:429,headers:{"retry-after":"10","cache-control":"no-store"},
      });
  }
}

export async function fetchRealtimeKitWebhookPublicKeyDocument(
  fetcher:typeof fetch=fetch,
  timeoutMs=WEBHOOK_KEY_REQUEST_TIMEOUT_MS,
){
  return withExternalRequestTimeout(async signal=>{
    const response=await fetcher(
      "https://api.realtime.cloudflare.com/.well-known/webhooks.json",{signal},
    );
    if(!response.ok)throw new Error("REALTIME_WEBHOOK_KEY_UNAVAILABLE");
    if(!String(response.headers.get("content-type")||"").toLowerCase()
      .startsWith("application/json"))throw new Error("REALTIME_WEBHOOK_KEY_INVALID_CONTENT_TYPE");
    const bounded=await readBoundedExternalResponseText(
      response,REALTIMEKIT_WEBHOOK_KEY_MAX_RESPONSE_BYTES,
    );
    if(bounded.truncated)throw new Error("REALTIME_WEBHOOK_KEY_RESPONSE_TOO_LARGE");
    return bounded.text;
  },timeoutMs);
}

export async function cachedRealtimeKitWebhookPublicKey(input:{
  request:Request;
  now?:number;
  cache?:Cache|null;
  runtime?:RuntimeEnvironment;
  guard?:()=>Promise<void>;
  loader?:()=>Promise<string>;
}){
  const now=input.now??Date.now();
  if(memoryEntry&&memoryEntry.expiresAt>now)return memoryEntry;
  memoryEntry=null;
  if(entryPromise)return entryPromise;
  const operation=(async()=>{
    const cache=input.cache===undefined?sharedCache():input.cache;
    if(cache){
      const shared=await readSharedEntry(cache,now);
      if(shared){memoryEntry=shared;return shared;}
    }
    await(input.guard?input.guard():keyFetchGuard(input.request,input.runtime));
    const document=await(input.loader
      ?input.loader():fetchRealtimeKitWebhookPublicKeyDocument());
    const completedAt=input.now??Date.now();
    const entry={
      pem:parseRealtimeKitWebhookPublicKeyDocument(document),
      fetchedAt:completedAt,
      expiresAt:completedAt+REALTIMEKIT_WEBHOOK_KEY_TTL_MS,
    };
    memoryEntry=entry;
    if(cache)await persistSharedEntry(cache,entry,completedAt);
    return entry;
  })().finally(()=>{if(entryPromise===operation)entryPromise=null;});
  entryPromise=operation;
  return operation;
}

function decodePem(pem:string){
  const encoded=pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,"");
  const binary=atob(encoded);
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}

export async function realtimeKitWebhookPublicKey(request:Request){
  const now=Date.now();
  if(importedKeyPromise){
    const imported=await importedKeyPromise.catch(()=>null);
    if(imported&&imported.expiresAt>now)return imported.key;
    importedKeyPromise=null;
  }
  const operation=(async()=>{
    const entry=await cachedRealtimeKitWebhookPublicKey({request});
    const key=await crypto.subtle.importKey(
      "spki",decodePem(entry.pem),
      {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"],
    );
    const algorithm=key.algorithm as RsaHashedKeyAlgorithm;
    if(algorithm.name!=="RSASSA-PKCS1-v1_5"
      ||algorithm.modulusLength<2048||algorithm.modulusLength>8192)
      throw new Error("REALTIME_WEBHOOK_KEY_UNSAFE_RSA_SIZE");
    return{key,pem:entry.pem,expiresAt:entry.expiresAt};
  })();
  importedKeyPromise=operation;
  try{return(await operation).key;}
  catch(error){
    if(importedKeyPromise===operation)importedKeyPromise=null;
    memoryEntry=null;
    await sharedCache()?.delete(cacheRequest()).catch(()=>undefined);
    throw error;
  }
}

export function resetRealtimeKitWebhookPublicKeyCacheForTests(){
  memoryEntry=null;entryPromise=null;importedKeyPromise=null;
}
