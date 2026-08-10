import { getClassRuntimeBindings } from "@/lib/live-class-runtime";
export type ClassParticipantRole="viewer"|"member"|"host";
type Envelope<T>={success?:boolean;result?:T;data?:T;errors?:Array<{message?:string}>};

async function config(){
  const env=getClassRuntimeBindings();
  const value={token:env.CLOUDFLARE_REALTIME_API_TOKEN||"",accountId:env.CLOUDFLARE_ACCOUNT_ID||"",appId:env.REALTIMEKIT_APP_ID||"",guest:env.REALTIMEKIT_GUEST_PRESET||"",member:env.REALTIMEKIT_MEMBER_PRESET||"",host:env.REALTIMEKIT_HOST_PRESET||"",viewer:env.REALTIMEKIT_VIEWER_PRESET||env.REALTIMEKIT_GUEST_PRESET||""};
  if(!value.token||!value.accountId||!value.appId||value.appId.includes("REQUIRED")||!value.member||!value.host||!value.viewer)throw new Error("REALTIME_NOT_CONFIGURED");
  return value;
}
async function call<T>(path:string,init:RequestInit){const value=await config();const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(value.accountId)}/realtime/kit/${encodeURIComponent(value.appId)}${path}`,{...init,headers:{authorization:`Bearer ${value.token}`,"content-type":"application/json",...(init.headers||{})}});const payload=await response.json().catch(()=>null)as Envelope<T>|null;const data=payload?.data??payload?.result;if(!response.ok||!payload?.success||!data)throw new Error(payload?.errors?.[0]?.message||`REALTIME_${response.status}`);return data;}
export async function createClassProviderRoom(title:string){return call<{id:string}>("/meetings",{method:"POST",body:JSON.stringify({title:title.slice(0,120)})});}
export async function createClassParticipant(meetingId:string,identity:string,name:string,role:ClassParticipantRole){const value=await config();const preset=role==="host"?value.host:role==="member"?value.member:value.viewer;return call<{id:string;token:string}>(`/meetings/${encodeURIComponent(meetingId)}/participants`,{method:"POST",body:JSON.stringify({name:name.slice(0,80)||"Guest",preset_name:preset,custom_participant_id:`${identity}:${crypto.randomUUID()}`})});}
