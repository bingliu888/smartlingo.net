import {readBoundedExternalResponseText,withExternalRequestTimeout} from "./external-request-timeout";
import {getClassRuntimeBindings} from "./live-class-runtime";
import {MAX_PROVIDER_SESSION_SECONDS} from "./class-session-policy";
import {
  providerPresetPolicyIsFresh,
  rememberProviderPresetPolicy,
} from "./provider-preset-policy-cache";
import {cachedRoomSnapshot,invalidateRoomSnapshot} from "./room-snapshot-cache";

export type MeetingParticipantRole = "viewer" | "guest" | "member" | "host";
export type RealtimeInteractionMode = "group_call" | "webinar" | "livestream";
type Config = {
  apiToken: string;
  accountId: string;
  appId: string;
  guestPreset: string;
  guestAudioPreset: string;
  memberPreset: string;
  memberAudioPreset: string;
  hostPreset: string;
  hostAudioPreset: string;
  viewerPreset: string;
  viewerAudioPreset: string;
  webinarHostPreset: string;
  webinarSpeakerPreset: string;
  webinarViewerPreset: string;
  livestreamHostPreset: string;
  livestreamSpeakerPreset: string;
  livestreamViewerPreset: string;
};
type Envelope<T> = { success?: boolean; result?: T; data?: T; errors?: Array<{ message?: string }> };
export class RealtimeProviderRequestError extends Error{
  readonly status:number|null;
  constructor(message:string,status:number|null){super(message);this.status=status;}
}
export type ProviderParticipant={
  id:string;
  custom_participant_id?:string;
  customParticipantId?:string;
};
type MediaProduction = { can_produce?: "ALLOWED" | "NOT_ALLOWED" | "CAN_REQUEST" };
type ProviderPermissions = Record<string, unknown> & {
  accept_stage_requests?: boolean;
  accept_waiting_requests?: boolean;
  can_accept_production_requests?: boolean;
  can_change_participant_permissions?: boolean;
  can_livestream?: boolean;
  can_record?: boolean;
  can_spotlight?: boolean;
  disable_participant_audio?: boolean;
  disable_participant_screensharing?: boolean;
  disable_participant_video?: boolean;
  hidden_participant?: boolean;
  kick_participant?: boolean;
  media?: {
    audio?: MediaProduction;
    screenshare?: MediaProduction;
    video?: MediaProduction;
  };
  pin_participant?: boolean;
  show_participant_list?: boolean;
  stage_access?: "ALLOWED" | "NOT_ALLOWED" | "CAN_REQUEST";
};
type ProviderPreset = {
  id?: string;
  name?: string;
  config?: Record<string, unknown> & { max_screenshare_count?: number };
  permissions?: ProviderPermissions;
  ui?: Record<string, unknown>;
};
type PresetPolicy = {
  moderator: boolean;
  audio: boolean;
  video: boolean;
  screenshare: boolean;
  participantList: boolean;
  hiddenParticipant: boolean;
  livestream?: boolean;
  stage?: boolean;
};
export type ParticipantMediaPolicy={audio:boolean;video:boolean;screenshare:boolean};

export function participantMediaPolicy(
  meetingMode:"audio"|"video",
  realtimeMode:RealtimeInteractionMode,
  role:MeetingParticipantRole,
  allowedMedia?:ParticipantMediaPolicy,
):ParticipantMediaPolicy{
  if(allowedMedia)return {...allowedMedia,video:meetingMode==="video"&&allowedMedia.video};
  if(role==="viewer")return {audio:false,video:false,screenshare:false};
  const moderator=role==="host";
  return {
    audio:true,
    video:meetingMode==="video",
    screenshare:realtimeMode==="group_call"||(moderator&&realtimeMode==="webinar"),
  };
}

export function stagedPublisherMediaPolicy(
  meetingMode:"audio"|"video",
  realtimeMode:RealtimeInteractionMode,
  role:MeetingParticipantRole,
  requested:ParticipantMediaPolicy,
):ParticipantMediaPolicy{
  const exact=participantMediaPolicy(meetingMode,realtimeMode,role,requested);
  if(realtimeMode==="group_call"||role==="viewer")return exact;
  // A trusted staged publisher keeps the capabilities attached to its one
  // reserved publisher slot for the lifetime of the connected participant.
  // RealtimeKit does not reliably refresh a narrower participant preset to a
  // wider one on an already-connected Safari client. Device enabled state is
  // still committed independently, and ordinary webinar guests retain only
  // the exact audio/video capabilities approved by a manager.
  if(role==="host"||(realtimeMode==="livestream"&&role==="member"))
    return participantMediaPolicy(meetingMode,realtimeMode,role);
  return exact;
}

export function participantPresetVariant(base:string,role:MeetingParticipantRole,media:ParticipantMediaPolicy){
  const capabilities=`${media.audio?"a":""}${media.video?"v":""}${media.screenshare?"s":""}`||"listen";
  // Every staged role/capability combination needs its own immutable preset.
  // Reusing the configured base for both subscribe-only and full A/V caused
  // one host's authorization PATCH to silently grant publishing to other
  // unreserved host/co-host tokens that referenced the same preset.
  return `${base}_${role}_${capabilities}`;
}

export function groupCallPresetName(
  meetingMode:"audio"|"video",
  role:MeetingParticipantRole,
  media:ParticipantMediaPolicy,
){
  const capabilities=`${media.audio?"a":""}${media.video?"v":""}${media.screenshare?"s":""}`||"listen";
  const sourceVersion = meetingMode === "audio" && (media.video || media.screenshare)
    ? "_av2"
    : "";
  return `smartlingo_gold_group_${meetingMode}_${role}_${capabilities}${sourceVersion}`;
}
const securedPresetPromises = new Map<string, Promise<void>>();
const providerPresetSearchPromises = new Map<string,Promise<ProviderPreset|null>>();

export function providerPresetSearchPath(name:string){
  return `/presets?search=${encodeURIComponent(name)}&per_page=100`;
}

async function runtimeConfig(): Promise<Config> {
  const values = getClassRuntimeBindings() as Record<string, string | undefined>;
  const config = {
    apiToken: values.CLOUDFLARE_REALTIME_API_TOKEN || "",
    accountId: values.CLOUDFLARE_ACCOUNT_ID || "",
    appId: values.REALTIMEKIT_APP_ID || "",
    // The existing *_PRESET values remain the A/V presets for compatibility.
    guestPreset: values.REALTIMEKIT_GUEST_AV_PRESET || values.REALTIMEKIT_GUEST_PRESET || "",
    guestAudioPreset: values.REALTIMEKIT_GUEST_AUDIO_PRESET || "smartlingo_group_audio_guest",
    memberPreset: values.REALTIMEKIT_MEMBER_AV_PRESET || values.REALTIMEKIT_MEMBER_PRESET || "",
    memberAudioPreset: values.REALTIMEKIT_MEMBER_AUDIO_PRESET || "smartlingo_group_audio_member",
    hostPreset: values.REALTIMEKIT_HOST_AV_PRESET || values.REALTIMEKIT_HOST_PRESET || "",
    hostAudioPreset: values.REALTIMEKIT_HOST_AUDIO_PRESET || "smartlingo_group_audio_host",
    // A viewer preset should allow subscribe/playback but deny publishing.
    // Fallback retains compatibility until the dedicated preset is configured.
    viewerPreset: values.REALTIMEKIT_VIEWER_AV_PRESET || values.REALTIMEKIT_VIEWER_PRESET || "smartlingo_group_av_viewer",
    viewerAudioPreset: values.REALTIMEKIT_VIEWER_AUDIO_PRESET || "smartlingo_group_audio_viewer",
    webinarHostPreset: values.REALTIMEKIT_WEBINAR_HOST_PRESET || "webinar_presenter",
    webinarSpeakerPreset: values.REALTIMEKIT_WEBINAR_SPEAKER_PRESET || "smartlingo_webinar_speaker",
    webinarViewerPreset: values.REALTIMEKIT_WEBINAR_VIEWER_PRESET || "webinar_viewer",
    livestreamHostPreset: values.REALTIMEKIT_LIVESTREAM_HOST_PRESET || "livestream_host",
    livestreamSpeakerPreset: values.REALTIMEKIT_LIVESTREAM_SPEAKER_PRESET || "smartlingo_livestream_speaker",
    livestreamViewerPreset: values.REALTIMEKIT_LIVESTREAM_VIEWER_PRESET || "livestream_viewer"
  };
  if (Object.values(config).some(value => !value)) throw new Error("REALTIME_NOT_CONFIGURED");
  return config;
}

async function call<T>(path: string, init: RequestInit) {
  const config = await runtimeConfig();
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}`;
  const {response,payload}=await withExternalRequestTimeout(async signal=>{
    const response=await fetch(`${base}${path}`, {
      ...init,
      signal,
      headers: { authorization: `Bearer ${config.apiToken}`, "content-type": "application/json", ...(init.headers || {}) },
    });
    const raw=await readBoundedExternalResponseText(response,1024*1024);
    let payload:Envelope<T>|null=null;
    if(!raw.truncated){try{payload=JSON.parse(raw.text) as Envelope<T>;}catch{/* invalid provider JSON */}}
    return {response,payload};
  });
  const data = payload?.data ?? payload?.result;
  if (!response.ok || !payload?.success || !data)
    throw new RealtimeProviderRequestError(
      payload?.errors?.[0]?.message || `REALTIME_${response.status}`,
      response.status,
    );
  return data;
}

async function callActionAccepting(
  path: string,
  init: RequestInit,
  acceptedStatuses: readonly number[],
) {
  const config = await runtimeConfig();
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/realtime/kit/${encodeURIComponent(config.appId)}`;
  const {response,payload}=await withExternalRequestTimeout(async signal=>{
    const response=await fetch(`${base}${path}`, {
      ...init,
      signal,
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });
    let payload:Envelope<unknown>|null=null;
    if(!acceptedStatuses.includes(response.status)){
      const raw=await readBoundedExternalResponseText(response,512*1024);
      if(!raw.truncated){try{payload=JSON.parse(raw.text) as Envelope<unknown>;}catch{/* invalid provider JSON */}}
    }
    return {response,payload};
  });
  if (acceptedStatuses.includes(response.status)) return response.status;
  if (!response.ok || payload?.success === false)
    throw new Error(payload?.errors?.[0]?.message || `REALTIME_${response.status}`);
  return response.status;
}

async function providerPresetByName(name:string,refresh=false){
  if(refresh)providerPresetSearchPromises.delete(name);
  const existing=providerPresetSearchPromises.get(name);
  if(existing)return existing;
  // RealtimeKit paginates the global preset collection. Looking only at the
  // first 100 rows can falsely report an existing Gold preset as absent; the
  // following create then returns 409 and blocks the participant join behind
  // its durable ambiguity record. Search by the exact name and still verify
  // the returned row because the provider search is allowed to be partial.
  const request=call<ProviderPreset[]>(providerPresetSearchPath(name),{method:"GET"})
    .then(presets=>presets.find(item=>item.name===name)||null);
  providerPresetSearchPromises.set(name,request);
  try{return await request;}
  catch(error){
    if(providerPresetSearchPromises.get(name)===request)
      providerPresetSearchPromises.delete(name);
    throw error;
  }
}

function securedPermissions(current:ProviderPermissions|undefined,policy:PresetPolicy):ProviderPermissions {
  // Every browser token is deliberately self-media-only. Host/co-host
  // moderation, permission changes, recording, and HLS start/stop all cross
  // an authenticated SmartLingo server route where D1 capacity, quota, and
  // current-role checks are atomic. Giving those provider capabilities to a
  // reusable browser token would let a modified client bypass those guards.
  const moderation={
    accept_stage_requests:false,
    accept_waiting_requests:false,
    can_accept_production_requests:false,
    can_change_participant_permissions:false,
    can_record:false,
    can_spotlight:false,
    disable_participant_audio:false,
    disable_participant_screensharing:false,
    disable_participant_video:false,
    hidden_participant:policy.hiddenParticipant,
    kick_participant:false,
    pin_participant:false,
  };
  return {
    ...(current||{}),
    ...moderation,
    can_livestream:false,
    // Group calls intentionally expose the room roster.  In staged rooms,
    // only a current host/co-host/admin token may request the full provider
    // participant list; ordinary viewers and invited speakers use the
    // publisher-only SmartLingo API projection instead.
    show_participant_list:policy.participantList,
    ...(typeof policy.stage==="boolean"?{stage_access:policy.stage?"ALLOWED" as const:"NOT_ALLOWED" as const}:{}),
    media:{
      ...(current?.media||{}),
      audio:{...(current?.media?.audio||{}),can_produce:policy.audio?"ALLOWED":"NOT_ALLOWED"},
      video:{...(current?.media?.video||{}),can_produce:policy.video?"ALLOWED":"NOT_ALLOWED"},
      screenshare:{...(current?.media?.screenshare||{}),can_produce:policy.screenshare?"ALLOWED":"NOT_ALLOWED"},
    },
  };
}

function presetMatchesPolicy(preset:ProviderPreset,policy:PresetPolicy){
  const permissions=preset.permissions;
  if(!permissions)return false;
  const expected=securedPermissions(permissions,policy);
  const moderatorKeys=[
    "accept_stage_requests","accept_waiting_requests","can_accept_production_requests",
    "can_change_participant_permissions","can_record","can_spotlight",
    "disable_participant_audio","disable_participant_screensharing",
    "disable_participant_video","kick_participant","pin_participant",
  ] as const;
  return moderatorKeys.every(key=>permissions[key]===expected[key])
    && permissions.can_livestream===expected.can_livestream
    && permissions.show_participant_list===policy.participantList
    && permissions.hidden_participant===policy.hiddenParticipant
    && (typeof policy.stage!=="boolean"||permissions.stage_access===expected.stage_access)
    && permissions.media?.audio?.can_produce===expected.media?.audio?.can_produce
    && permissions.media?.video?.can_produce===expected.media?.video?.can_produce
    && permissions.media?.screenshare?.can_produce===expected.media?.screenshare?.can_produce
    // D1 owns the user-facing screen-share claim, but the provider preset is
    // the independent enforcement boundary for modified clients.  Exactly
    // one provider screen share prevents a forged SDK client from bypassing
    // the claim route and publishing a second concurrent screen.
    && (!policy.screenshare||Number(preset.config?.max_screenshare_count||0)===1);
}

async function configureSecuredPreset(presetName:string,policy:PresetPolicy,sourceName:string,key:string) {
  // A policy proof reaches this function only after its short TTL has
  // expired. Refresh the provider list and then GET the target preset by id;
  // never renew a security proof from an isolate-lifetime list snapshot.
  let preset=await providerPresetByName(presetName,true);
  if(!preset?.id){
    const sourceSummary=await providerPresetByName(sourceName,true);
    if(!sourceSummary?.id)throw new Error(`REALTIME_PRESET_NOT_FOUND:${sourceName}`);
    const source=await call<ProviderPreset>(`/presets/${encodeURIComponent(sourceSummary.id)}`,{method:"GET"});
    if(!source.config||!source.permissions||!source.ui)
      throw new Error(`REALTIME_PRESET_SOURCE_INCOMPLETE:${sourceName}`);
    let createError:unknown;
    try{
      preset=await call<ProviderPreset>("/presets",{
        method:"POST",
        body:JSON.stringify({
          name:presetName,
          config:source.config,
          permissions:securedPermissions(source.permissions,policy),
          // Cloudflare's Create Preset API requires the complete UI object in
          // addition to config and permissions. Omitting it returns HTTP 400,
          // while a later Add Participant misleadingly reports only that the
          // requested preset does not exist.
          ui:source.ui,
        }),
      });
    }catch(error){
      createError=error;
      // Two first participants can race to create a derived least-privilege
      // preset. The winner owns creation; the loser resolves the same preset.
      preset=await providerPresetByName(presetName,true);
    }
    if(!preset?.id&&createError)throw createError;
  }
  if(!preset?.id)throw new Error(`REALTIME_PRESET_NOT_FOUND:${presetName}`);
  const details=await call<ProviderPreset>(`/presets/${encodeURIComponent(preset.id)}`,{method:"GET"});
  if(presetMatchesPolicy(details,policy)){
    await rememberProviderPresetPolicy(key);
    return;
  }
  await call<ProviderPreset>(`/presets/${encodeURIComponent(preset.id)}`,{
    method:"PATCH",
    body:JSON.stringify({
      ...(policy.screenshare&&Number(details.config?.max_screenshare_count||0)!==1
        ?{config:{...(details.config||{}),max_screenshare_count: 1}}:{}),
      permissions:securedPermissions(details.permissions,policy),
    }),
  });
  providerPresetSearchPromises.delete(presetName);
  const verified=await call<ProviderPreset>(`/presets/${encodeURIComponent(preset.id)}`,{method:"GET"});
  if(!presetMatchesPolicy(verified,policy))
    throw new Error(`REALTIME_PRESET_POLICY_UNVERIFIED:${presetName}`);
  await rememberProviderPresetPolicy(key);
}

async function ensureSecuredPreset(presetName:string,policy:PresetPolicy,sourceName=presetName) {
  const key=`${presetName}:${JSON.stringify(policy)}`;
  if(await providerPresetPolicyIsFresh(key))return;
  const existing=securedPresetPromises.get(key);
  if(existing)return existing;
  const task=configureSecuredPreset(presetName,policy,sourceName,key).finally(()=>{
    if(securedPresetPromises.get(key)===task)securedPresetPromises.delete(key);
  });
  securedPresetPromises.set(key,task);
  return task;
}

export type ProviderMeeting={
  id:string;
  title?:string;
  status?:string;
  created_at?:string;
};

type ProviderMeetingLookup=(meetingId:string)=>Promise<unknown>;

export function providerMeetingClosureIsAuthoritative(meeting:unknown){
  if(!meeting||typeof meeting!=="object")
    throw new Error("REALTIME_PROVIDER_MEETING_STATUS_MALFORMED");
  const status=(meeting as {status?:unknown}).status;
  if(status==="INACTIVE"||status==="CLOSED")return true;
  if(status==="ACTIVE")return false;
  throw new Error("REALTIME_PROVIDER_MEETING_STATUS_MALFORMED");
}

async function fetchProviderMeeting(meetingId:string){
  return cachedRoomSnapshot("provider-meeting-status",meetingId,1_500,async()=>{
    try{
      return await call<ProviderMeeting>(`/meetings/${encodeURIComponent(meetingId)}`,{
        method:"GET",
      });
    }catch(error){
      // A provider 404 is a stable terminal observation for this very short
      // window. Cache the terminal sentinel so a failing browser SDK cannot
      // fan a thousand simultaneous retries into the provider status API.
      if(error instanceof RealtimeProviderRequestError&&error.status===404)
        return {id:meetingId,status:"CLOSED"};
      throw error;
    }
  });
}

// A browser-side SDK error is only a retry hint, never evidence that a whole
// room may be retired.  RealtimeKit's authenticated meeting resource is the
// authority: an explicit terminal status or a real provider 404 is safe to
// replace. Transport loss, throttling, conflicts, 5xx, and malformed 2xx
// payloads deliberately throw so callers fail closed without queuing teardown.
export async function providerMeetingIsAuthoritativelyClosed(
  meetingId:string,
  lookup:ProviderMeetingLookup=fetchProviderMeeting,
){
  try{
    return providerMeetingClosureIsAuthoritative(await lookup(meetingId));
  }catch(error){
    if(error instanceof RealtimeProviderRequestError&&error.status===404)return true;
    throw error;
  }
}

export function providerMeetingCreateCorrelationPrefix(correlationId:string){
  const normalized=correlationId.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,48);
  if(normalized.length<16)throw new Error("PROVIDER_MEETING_CORRELATION_INVALID");
  return `[GWG2:${normalized}]`;
}

export function providerMeetingCreateTitle(userTitle:string,correlationId:string){
  const prefix=providerMeetingCreateCorrelationPrefix(correlationId);
  const normalized=String(userTitle||"").replace(/\s+/g," ").trim();
  const roomTitle=normalized.slice(0,Math.max(0,120-prefix.length-1));
  return `${prefix} ${roomTitle}`.trim().slice(0,120);
}

export function providerMeetingCreatePayload(
  title:string,
  paid=false,
  livestream=false,
  correlationId?:string,
){
  void paid;void livestream;
  return {
    title: correlationId?providerMeetingCreateTitle(title,correlationId):title.slice(0,120),
    // Room creation never grants implicit whole-session capture or AI
    // processing. Paid hosts still start an explicitly quota-reserved,
    // webhook-tracked recording from the recording route; processing audio
    // outside that visible recording window would be a privacy/cost defect.
    record_on_start:false,
    transcribe_on_end:false,
    summarize_on_end:false,
  };
}

export function providerMeetingCreateFailureIsDefinite(error:unknown){
  if(!(error instanceof RealtimeProviderRequestError)||error.status===null)return false;
  // Validation/authentication/not-found/rate-limit 4xx responses prove the
  // provider rejected POST /meetings, so retaining a discovery row would only
  // lock entry until cron. 408 and 409 are conservatively uncertain: an edge
  // timeout or conflict can arrive after the upstream accepted a side effect.
  return error.status>=400&&error.status<500
    &&error.status!==408&&error.status!==409;
}

export async function createProviderMeeting(title: string, paid = false, livestream = false, correlationId?:string) {
  return call<ProviderMeeting>("/meetings", {
    method:"POST",
    body:JSON.stringify(providerMeetingCreatePayload(title,paid,livestream,correlationId)),
  });
}

export async function findProviderMeetingsByExactTitle(providerTitle:string){
  const result=await call<ProviderMeeting[]|{
    meetings?:ProviderMeeting[];
    results?:ProviderMeeting[];
  }>(`/meetings?search=${encodeURIComponent(providerTitle)}&page_no=1&per_page=100`,{
    method:"GET",
  });
  const meetings=Array.isArray(result)?result:result.meetings||result.results||[];
  // The search endpoint is intentionally broad. Only the full machine title
  // is authoritative; a user room with a similar title must never be stopped.
  return meetings.filter(meeting=>meeting.title===providerTitle);
}

export async function hardenProviderMeetingPrivacy(meetingId:string){
  const status=await callActionAccepting(
    `/meetings/${encodeURIComponent(meetingId)}`,
    {method:"PATCH",body:JSON.stringify({
      record_on_start:false,
      transcribe_on_end:false,
      summarize_on_end:false,
    })},
    // A provider already retired between the D1 scan and PATCH is a safe
    // terminal state and must not poison the bounded recovery queue.
    [404],
  );
  return status!==404;
}

export type ProviderLivestream = { id?: string; status?: "LIVE" | "IDLE" | "ERRORED" | "INVOKED"; playback_url?: string };

export async function getProviderLivestream(meetingId: string) {
  return call<ProviderLivestream>(
    `/meetings/${encodeURIComponent(meetingId)}/active-livestream`,
    { method: "GET" },
  ).catch(() => null);
}

export async function stopProviderLivestream(meetingId: string) {
  await call<{ message?: string }>(
    `/meetings/${encodeURIComponent(meetingId)}/active-livestream/stop`,
    { method: "POST", body: "{}" },
  );
}

export async function stopProviderLivestreamForTeardown(meetingId: string) {
  await callActionAccepting(
    `/meetings/${encodeURIComponent(meetingId)}/active-livestream/stop`,
    { method: "POST", body: "{}" },
    [400, 404, 409],
  );
}

const waitForProvider = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function settleInvokedLivestream(
  meetingId: string,
  initial: ProviderLivestream,
) {
  let current = initial;
  for (let attempt = 0; attempt < 4 && current.status === "INVOKED"; attempt += 1) {
    await waitForProvider(3000);
    current =
      (await call<ProviderLivestream>(
        `/meetings/${encodeURIComponent(meetingId)}/active-livestream`,
        { method: "GET" },
      ).catch(() => current)) || current;
  }
  return current;
}

async function logProviderLivestreamFailure(livestream: ProviderLivestream) {
  if (livestream.status !== "ERRORED" || !livestream.id) return;
  const details = await call<{
    livestream?: ProviderLivestream;
    session?: { err_message?: string };
  }>(`/livestreams/${encodeURIComponent(livestream.id)}/active-livestream-session`, {
    method: "GET",
  }).catch(() => null);
  console.warn(
    "RealtimeKit livestream export errored",
    details?.session?.err_message?.slice(0, 240) || "No provider error message",
  );
}

export async function ensureProviderLivestream(meetingId: string) {
  let active = await getProviderLivestream(meetingId);
  if (active?.status === "INVOKED")
    active = await settleInvokedLivestream(meetingId, active);
  if (active && (active.status === "LIVE" || active.status === "INVOKED")) return active;
  if (active) {
    await logProviderLivestreamFailure(active);
    await call<{ message?: string }>(`/meetings/${encodeURIComponent(meetingId)}/active-livestream/stop`, {
      method: "POST",
      body: "{}",
    }).catch(() => null);
  }
  try {
    return await call<ProviderLivestream>(`/meetings/${encodeURIComponent(meetingId)}/livestreams`, {
      method: "POST",
      body: JSON.stringify({
        name: "SmartLingo live broadcast",
        video_config: { width: 1280, height: 720 },
      }),
    });
  } catch (startError) {
    // Two moderators can request delivery at nearly the same time. The
    // provider accepts the first request and rejects the duplicate, so verify
    // the active delivery before surfacing a false failure to the second host.
    let recovered = await getProviderLivestream(meetingId);
    if (recovered && (recovered.status === "LIVE" || recovered.status === "INVOKED"))
      return recovered;
    // During playlist-to-camera handoff the previous export can still be
    // stopping for a few seconds. RealtimeKit returns REALTIME_400 when the
    // replacement is requested inside that transition. Let a concurrent SDK
    // start settle first; otherwise retire the stale export and retry once.
    await waitForProvider(3000);
    recovered = await getProviderLivestream(meetingId);
    if (recovered && (recovered.status === "LIVE" || recovered.status === "INVOKED"))
      return recovered;
    if (recovered) {
      await call<{ message?: string }>(
        `/meetings/${encodeURIComponent(meetingId)}/active-livestream/stop`,
        { method: "POST", body: "{}" },
      ).catch(() => null);
      await waitForProvider(1500);
    }
    try {
      return await call<ProviderLivestream>(
        `/meetings/${encodeURIComponent(meetingId)}/livestreams`,
        {
          method: "POST",
          body: JSON.stringify({
            name: "SmartLingo live broadcast",
            video_config: { width: 1280, height: 720 },
          }),
        },
      );
    } catch {
      throw startError;
    }
  }
}

export type ProviderRecording = {
  id: string;
  session_id?: string;
  status?: string;
  invoked_time?: string;
  output_file_name?: string;
};

export function recordingCorrelationPrefix(correlationId:string){
  const normalized=correlationId.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,48);
  if(normalized.length<16)throw new Error("RECORDING_CORRELATION_INVALID");
  return `smartlingo-${normalized}`;
}

export async function startProviderRecording(
  meetingId: string,
  maxSeconds: number,
  correlationId: string,
) {
  return call<ProviderRecording>("/recordings", {
    method: "POST",
    body: JSON.stringify({
      meeting_id: meetingId,
      // The provider supports one active recording by default.  Keep this
      // explicit so a retry or dashboard drift cannot create parallel cost.
      allow_multiple_recordings: false,
      file_name_prefix: recordingCorrelationPrefix(correlationId),
      max_seconds: Math.min(MAX_PROVIDER_SESSION_SECONDS, Math.max(60, maxSeconds)),
      audio_config: { codec: "AAC", channel: "stereo", export_file: true },
      realtimekit_bucket_config: { enabled: true },
    })
  });
}

export function providerRecordingStartFailureIsDefinite(error:unknown){
  if(!(error instanceof RealtimeProviderRequestError)||error.status===null)return false;
  // A normal 4xx response proves Start Recording was rejected. Network loss,
  // 5xx, edge timeout, and conflict remain ambiguous because the provider may
  // have committed the correlated side effect before the response was lost.
  return error.status>=400&&error.status<500
    &&error.status!==408&&error.status!==409;
}

export async function findProviderRecordingByCorrelation(
  meetingId:string,
  correlationId:string,
  attemptedAt:number,
){
  const prefix=recordingCorrelationPrefix(correlationId);
  const recordings:ProviderRecording[]=[];
  const startTime=new Date(Math.max(0,attemptedAt-120)*1000).toISOString();
  // A long-lived room can have more than 100 historical recordings. Query a
  // provider-supported time window in newest-first order, page it with a hard
  // ceiling, and refuse to prove absence if the bounded result is truncated.
  // Thus three empty recovery observations can never mean merely “not on the
  // provider's arbitrary first page”.
  for(let pageNo=1;pageNo<=3;pageNo+=1){
    const query=new URLSearchParams({
      meeting_id:meetingId,page_no:String(pageNo),per_page:"100",
      start_time:startTime,sort_by:"invokedTime",sort_order:"DESC",
    });
    const page=await call<ProviderRecording[]>(`/recordings?${query}`,{method:"GET"});
    const exact=page.find(recording=>
      typeof recording.output_file_name==="string"&&recording.output_file_name.includes(prefix),
    );
    if(exact)return exact;
    recordings.push(...page);
    if(page.length<100)break;
    if(pageNo===3)throw new Error("RECORDING_RECOVERY_RESULT_TRUNCATED");
  }
  // Defensive fallback for providers that normalize the file prefix in their
  // response. Browser tokens cannot start recordings and SmartLingo keeps
  // one active recording per provider meeting, so one active invocation in
  // the claim window is the same side effect and must be stopped fail-closed.
  const candidates=recordings.filter(recording=>{
    if(!["INVOKED","RECORDING","PAUSED","UPLOADING"].includes(
      String(recording.status||"").toUpperCase(),
    ))return false;
    const invoked=Math.floor(Date.parse(recording.invoked_time||"")/1000);
    return Number.isFinite(invoked)&&invoked>=attemptedAt-60;
  });
  if(candidates.length===1)return candidates[0];
  if(candidates.length>1)throw new Error("RECORDING_CORRELATION_AMBIGUOUS");
  return null;
}

export async function stopProviderRecording(recordingId: string) {
  return call<{ id: string; status?: string }>(`/recordings/${encodeURIComponent(recordingId)}`, { method: "PUT", body: JSON.stringify({ action: "stop" }) });
}

export async function stopProviderRecordingForTeardown(recordingId: string) {
  await callActionAccepting(
    `/recordings/${encodeURIComponent(recordingId)}`,
    { method: "PUT", body: JSON.stringify({ action: "stop" }) },
    [404, 409],
  );
}

export async function kickAllProviderParticipants(meetingId: string) {
  // RealtimeKit returns 400/404/409 when the meeting no longer has an active
  // session. Those states are already equivalent to a successful teardown.
  await callActionAccepting(
    `/meetings/${encodeURIComponent(meetingId)}/active-session/kick-all`,
    { method: "POST", body: "{}" },
    [400, 404, 409],
  );
}

export async function deactivateProviderMeeting(meetingId: string) {
  await callActionAccepting(
    `/meetings/${encodeURIComponent(meetingId)}`,
    { method: "PATCH", body: JSON.stringify({ status: "INACTIVE" }) },
    [404],
  );
  await invalidateRoomSnapshot("provider-meeting-status",meetingId);
}

export async function ensureProviderWebhook(url: string) {
  const result = await call<Array<{ id?:string; url?:string }> | { webhooks?:Array<{ id?:string; url?:string }> }>("/webhooks/all", { method:"GET" }).catch(() => []);
  const existing = Array.isArray(result) ? result : result.webhooks || [];
  if (existing.some(item => item.url === url)) return;
  await call<{ id:string }>("/webhooks", { method:"POST", body:JSON.stringify({
    name:"SmartLingo production artifacts", url,
    events:["recording.statusUpdate","meeting.transcript","meeting.summary"], enabled:true
  }) });
}

async function securedParticipantPreset(
  role: MeetingParticipantRole,
  meetingMode: "audio" | "video",
  realtimeMode: RealtimeInteractionMode,
  allowedMedia?: ParticipantMediaPolicy,
) {
  const config = await runtimeConfig();
  const audio = meetingMode === "audio";
  const groupCallPeer = realtimeMode === "group_call";
  const basePresetName = realtimeMode === "webinar"
    ? role === "viewer"
      ? config.webinarViewerPreset
      : role === "host"
        ? config.webinarHostPreset
        : config.webinarSpeakerPreset
    : realtimeMode === "livestream"
      ? role === "viewer"
        ? config.livestreamViewerPreset
        : role === "host"
          ? config.livestreamHostPreset
          : config.livestreamSpeakerPreset
      : role === "host"
        ? audio
          ? config.hostAudioPreset
          : config.hostPreset
        : role === "member"
          ? audio
            ? config.memberAudioPreset
            : config.memberPreset
          : role === "viewer"
            ? audio
              ? config.viewerAudioPreset
              : config.viewerPreset
            : audio
              ? config.guestAudioPreset
              : config.guestPreset;
  const moderator=role==="host";
  const permitted = participantMediaPolicy(meetingMode, realtimeMode, role, allowedMedia);
  // Group-call guest/member presets on the original RealtimeKit application
  // have historically allowed a local preview while suppressing the remote
  // RTP track. Clone the verified full-media host configuration into a unique
  // Gold preset for every role/capability combination, then apply the
  // least-privilege permissions below. Unique names also prevent concurrent
  // roles from racing to rewrite one shared preset's moderation permissions.
  const presetName = groupCallPeer
    ? groupCallPresetName(meetingMode,role,permitted)
    : participantPresetVariant(basePresetName, role, permitted);
  const policy: PresetPolicy = groupCallPeer
    ? {moderator,audio:permitted.audio,video:permitted.video,screenshare:permitted.screenshare,participantList:true,hiddenParticipant:false}
    : realtimeMode === "webinar"
      ? role === "viewer"
        ? {moderator:false,audio:permitted.audio,video:permitted.video,screenshare:permitted.screenshare,participantList:false,hiddenParticipant:true,stage:false}
        : {moderator,audio:permitted.audio,video:permitted.video,screenshare:permitted.screenshare,participantList:moderator,hiddenParticipant:false,stage:true}
      : role === "viewer"
        ? {moderator:false,audio:permitted.audio,video:permitted.video,screenshare:permitted.screenshare,participantList:false,hiddenParticipant:true,livestream:false,stage:false}
        : {moderator,audio:permitted.audio,video:permitted.video,screenshare:permitted.screenshare,participantList:moderator,hiddenParticipant:false,livestream:moderator,stage:true};
  const groupCallSourceName = permitted.video || permitted.screenshare
    ? config.hostPreset
    : audio
      ? config.hostAudioPreset
      : config.hostPreset;
  const sourceName = groupCallPeer
    ? groupCallSourceName
    : basePresetName === config.webinarSpeakerPreset && basePresetName !== config.webinarHostPreset
      ?config.webinarHostPreset
      :basePresetName === config.livestreamSpeakerPreset && basePresetName !== config.livestreamHostPreset
        ?config.livestreamHostPreset
        :basePresetName;
  await ensureSecuredPreset(presetName, policy, sourceName);
  return presetName;
}

export async function createProviderParticipant(
  meetingId: string,
  customParticipantId: string,
  displayName: string,
  role: MeetingParticipantRole,
  meetingMode: "audio" | "video",
  realtimeMode: RealtimeInteractionMode,
  allowedMedia?:ParticipantMediaPolicy,
) {
  const presetName=await securedParticipantPreset(role,meetingMode,realtimeMode,allowedMedia);
  // The caller persisted this opaque id before the non-idempotent provider
  // POST. Never regenerate it here: cron needs the exact same value to find
  // and remove a participant created across a lost response/isolate crash.
  if(!/^sl:[a-f0-9-]{36}:[a-f0-9-]{36}$/i.test(customParticipantId))
    throw new Error("PROVIDER_CUSTOM_PARTICIPANT_ID_INVALID");
  const participant=await call<{ id: string; token: string }>(`/meetings/${encodeURIComponent(meetingId)}/participants`, {
    method: "POST",
    body: JSON.stringify({ name: displayName.slice(0, 80) || "Guest", preset_name: presetName, custom_participant_id: customParticipantId })
  });
  // A malformed 2xx is still an ambiguous external side effect. Throwing a
  // status-less error keeps the durable attempt for exact-id reconciliation;
  // it must never attach an empty provider id or discard recovery evidence.
  if(!participant||typeof participant.id!=="string"||!participant.id
    ||typeof participant.token!=="string"||!participant.token)
    throw new Error("PROVIDER_PARTICIPANT_RESULT_MALFORMED");
  return participant;
}

export function providerParticipantCreateFailureIsDefinite(error:unknown){
  if(!(error instanceof RealtimeProviderRequestError)||error.status===null)return false;
  // A normal 4xx response proves Add Participant was rejected. Network loss,
  // 5xx, gateway timeout, and conflict remain ambiguous because the provider
  // may have committed the unique custom id before the response was lost.
  return error.status>=400&&error.status<500
    &&error.status!==408&&error.status!==409;
}

export async function findProviderParticipantByCustomId(
  meetingId:string,
  customParticipantId:string,
){
  const snapshot=await listProviderParticipantsForRecovery(meetingId);
  const exact=snapshot.participants.find(participant=>
    (participant.custom_participant_id||participant.customParticipantId)===customParticipantId,
  );
  if(exact)return exact;
  if(!snapshot.complete)throw new Error("PARTICIPANT_RECOVERY_RESULT_TRUNCATED");
  return null;
}

export type ProviderParticipantRecoverySnapshot={
  participants:ProviderParticipant[];
  complete:boolean;
  pages:number;
};

export async function listProviderParticipantsForRecovery(
  meetingId:string,
):Promise<ProviderParticipantRecoverySnapshot>{
  // Group rooms cap at 100 and staged rooms at 1000. The eleventh page is a
  // bounded overflow sentinel. One snapshot serves every due attempt for the
  // same fixed provider room. An empty sentinel proves completeness; any
  // overflow remains usable for exact matches but cannot prove absence.
  const all:ProviderParticipant[]=[];
  for(let pageNo=1;pageNo<=11;pageNo+=1){
    const result=await call<ProviderParticipant[]|{
      participants?:ProviderParticipant[];
      results?:ProviderParticipant[];
    }>(`/meetings/${encodeURIComponent(meetingId)}/participants?page_no=${pageNo}&per_page=100`,{
      method:"GET",
    });
    const participants=Array.isArray(result)
      ?result
      :Array.isArray(result.participants)
        ?result.participants
        :Array.isArray(result.results)
          ?result.results
          :null;
    if(!participants)throw new Error("PARTICIPANT_RECOVERY_RESULT_MALFORMED");
    all.push(...participants);
    if(pageNo===11)return {
      participants:all,complete:participants.length===0,pages:pageNo,
    };
    if(participants.length<100)return {participants:all,complete:true,pages:pageNo};
  }
  return {participants:all,complete:false,pages:11};
}

export async function updateProviderParticipantPreset(
  meetingId: string,
  participantId: string,
  role: MeetingParticipantRole,
  meetingMode: "audio" | "video",
  realtimeMode: RealtimeInteractionMode,
  allowedMedia: ParticipantMediaPolicy,
) {
  const presetName = await securedParticipantPreset(role, meetingMode, realtimeMode, allowedMedia);
  return call<{id:string;token:string}>(`/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(participantId)}`, {
    method: "PATCH",
    body: JSON.stringify({preset_name:presetName}),
  });
}

export async function removeProviderParticipant(meetingId: string, participantId: string) {
  await callActionAccepting(
    `/meetings/${encodeURIComponent(meetingId)}/participants/${encodeURIComponent(participantId)}`,
    { method: "DELETE" },
    [404],
  );
}

// Compatibility names used by SmartLingo's existing course routes.
export type ClassParticipantRole = MeetingParticipantRole;
export type ClassRealtimeMode = RealtimeInteractionMode;
export async function createClassProviderRoom(title:string) {
  return createProviderMeeting(title,false,false,crypto.randomUUID());
}
export async function createClassParticipant(
  meetingId:string,
  identity:string,
  name:string,
  role:ClassParticipantRole,
  mode:ClassRealtimeMode,
  meetingMode:"audio"|"video"="video",
) {
  void identity;
  return createProviderParticipant(
    meetingId,
    `sl:${crypto.randomUUID()}:${crypto.randomUUID()}`,
    name,
    role,
    meetingMode,
    mode,
  );
}
