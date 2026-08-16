"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RTKClient from "@cloudflare/realtimekit";
import { ContentShareStudio } from "@/components/class-content-share";

type Lang = "en" | "zh";
type Share = { id: string; name: string; local: boolean; video: MediaStreamTrack; audio?: MediaStreamTrack };
type ScreenPeer = { id: string; name?: string; videoEnabled?: boolean; videoTrack?: MediaStreamTrack; screenShareEnabled?: boolean; screenShareTracks?: { video?: MediaStreamTrack; audio?: MediaStreamTrack } };

export function ClassScreenShareButton({ client, manager, lang, disabled, onError, ensurePublisher, onSharingChange }: {
  client?: RTKClient;
  manager: boolean;
  lang: Lang;
  disabled?: boolean;
  onError: (message: string) => void;
  ensurePublisher?: () => Promise<RTKClient | undefined>;
  onSharingChange?: (sharing:boolean) => void;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(Boolean(client?.self.screenShareEnabled));
  const [supported, setSupported] = useState(false);
  useEffect(()=>{const nav=navigator as Navigator&{platform?:string;maxTouchPoints?:number};const mobile=/Android|iPhone|iPad|iPod/i.test(nav.userAgent)||(nav.platform==="MacIntel"&&(nav.maxTouchPoints||0)>1);setSupported(!mobile&&Boolean(navigator.mediaDevices?.getDisplayMedia))},[]);
  useEffect(() => {
    if(!client){setSharing(false);return;}
    const update = ({ screenShareEnabled }: { screenShareEnabled: boolean }) => {setSharing(screenShareEnabled);onSharingChange?.(screenShareEnabled)};
    client.self.on("screenShareUpdate", update);
    const timer = window.setInterval(() => setSharing(Boolean(client.self.screenShareEnabled)), 500);
    return () => { client.self.off("screenShareUpdate", update); window.clearInterval(timer); };
  }, [client,onSharingChange]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setBusy(true);
      void (async()=>{const active=client||await ensurePublisher?.();if(!active)throw new Error("SCREEN_SHARE_ROOM_NOT_READY");await active.self.enableScreenShare()})()
        .then(() => { setSharing(true); onSharingChange?.(true); onError(""); })
        .catch((error: unknown) => {
          const canceled = error instanceof Error && (error.name === "NotAllowedError" || /CANCELED|CANCELLED|denied/i.test(error.message));
          onError(canceled
            ? (lang === "zh" ? "已取消屏幕共享。" : "Screen sharing was canceled.")
            : (lang === "zh" ? "无法共享屏幕。请检查屏幕录制权限，或确认当前没有其他人正在共享。" : "Could not share the screen. Check screen-recording permission or whether someone else is already sharing."));
        })
        .finally(() => setBusy(false));
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [client, countdown, ensurePublisher, lang, onError, onSharingChange]);
  if (!manager || !supported) return null;
  const label = sharing ? (lang === "zh" ? "停止共享" : "Stop sharing") : (lang === "zh" ? "共享屏幕" : "Share screen");
  return <>
    <button className={sharing ? "on class-screen-share-button" : "class-screen-share-button"} disabled={disabled || busy || countdown !== null} onClick={() => sharing ? void client?.self.disableScreenShare().then(()=>onSharingChange?.(false)).catch(() => onError(lang === "zh" ? "无法停止屏幕共享。" : "Could not stop screen sharing.")) : setCountdown(5)} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M8 21h8M12 17v4M12 13V7m0 0-3 3m3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    </button>
    {countdown !== null && typeof document !== "undefined" ? createPortal(<div className="class-screen-share-countdown" role="dialog" aria-modal="true"><div><span>{countdown}</span><strong>{lang === "zh" ? "即将共享屏幕" : "Screen sharing starts soon"}</strong><p>{lang === "zh" ? "请选择屏幕、窗口或浏览器标签页。" : "Choose a screen, window, or browser tab."}</p><button onClick={() => setCountdown(null)}>{lang === "zh" ? "取消" : "Cancel"}</button></div></div>, document.body) : null}
  </>;
}

function Player({ share, listening, full, onOpen }: { share: Share; listening: boolean; full?: boolean; onOpen?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null), audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { const video = videoRef.current; if (!video) return; video.srcObject = new MediaStream([share.video]); return () => { video.srcObject = null; }; }, [share.video]);
  useEffect(() => { const audio = audioRef.current; if (!audio || share.local || !share.audio) return; audio.srcObject = new MediaStream([share.audio]); if (listening) void audio.play().catch(() => undefined); else audio.pause(); return () => { audio.pause(); audio.srcObject = null; }; }, [listening, share.audio, share.local]);
  const content = <><video ref={videoRef} autoPlay playsInline muted={share.local}/>{!share.local && share.audio ? <audio ref={audioRef} autoPlay={listening}/> : null}<span>{share.name} · {share.local ? "You are sharing" : "Screen share"}</span></>;
  if (!full && share.local) return <div className="class-screen-share-player is-local-preview">{content}</div>;
  return full ? <div className="class-screen-share-player selected">{content}</div> : <button className="class-screen-share-player" onClick={onOpen}>{content}</button>;
}

export function ClassScreenShareStage({ client, lang, listening }: { client: RTKClient; lang: Lang; listening: boolean }) {
  const [revision, setRevision] = useState(0), [fullId, setFullId] = useState<string | null>(null);
  useEffect(() => { const refresh = () => setRevision((value) => value + 1); client.self.on("screenShareUpdate", refresh); const timer = window.setInterval(refresh, 500); return () => { client.self.off("screenShareUpdate", refresh); window.clearInterval(timer); }; }, [client]);
  const shares = useMemo(() => {
    void revision;
    const items: Share[] = [];
    if (client.self.screenShareEnabled && client.self.screenShareTracks?.video) items.push({ id: "self", name: client.self.name || (lang === "zh" ? "我" : "You"), local: true, video: client.self.screenShareTracks.video, audio: client.self.screenShareTracks.audio });
    const peers = new Map<string, ScreenPeer>();
    for (const map of [client.participants.joined, client.participants.active]) for (const peer of map.toArray() as unknown as ScreenPeer[]) peers.set(peer.id, peer);
    const ids = [...peers.keys()];
    if (ids.length) void client.participants.subscribe(ids, ["screenshareAudio", "screenshareVideo"]).catch(() => undefined);
    for (const peer of peers.values()) if (peer.screenShareEnabled && peer.screenShareTracks?.video) items.push({ id: peer.id, name: peer.name || (lang === "zh" ? "参与者" : "Participant"), local: false, video: peer.screenShareTracks.video, audio: peer.screenShareTracks.audio });
    return items;
  }, [client, lang, revision]);
  useEffect(() => { if (fullId && !shares.some((share) => share.id === fullId)) setFullId(null); }, [fullId, shares]);
  if (!shares.length) return null;
  const full = shares.find((share) => share.id === fullId);
  return <><section className="class-screen-share-stage"><header><strong>{lang === "zh" ? "正在共享屏幕" : "Screen sharing"}</strong><span>{shares.length}</span></header>{shares.map((share) => <Player key={share.id} share={share} listening={listening && share.id !== fullId} onOpen={share.local?undefined:()=>setFullId(share.id)}/>)}</section>{full && typeof document !== "undefined" ? createPortal(<div className="class-screen-share-fullscreen" onClick={() => setFullId(null)} role="dialog" aria-modal="true"><Player share={full} listening={listening} full/><button onClick={() => setFullId(null)} aria-label={lang === "zh" ? "返回课堂" : "Back to class"}>×</button></div>, document.body) : null}</>;
}

async function ensureCompanionStage(client:RTKClient){const status=()=>String(client.self.stageStatus);if(status()==="ON_STAGE")return;if(status()==="OFF_STAGE")await client.stage.requestAccess();for(let attempt=0;attempt<50;attempt+=1){if(status()==="ON_STAGE")return;if(status()==="ACCEPTED_TO_JOIN_STAGE"){await client.stage.join();if(status()==="ON_STAGE")return}await new Promise(resolve=>window.setTimeout(resolve,200))}throw new Error("COMPANION_STAGE_NOT_READY")}

export function ClassAudioScreenShare({ code, displayName, manager, lang, listening, onError, apiBase="/api/classes" }: { code:string; displayName:string; manager:boolean; lang:Lang; listening:boolean; onError:(message:string)=>void; apiBase?:string }) {
  const [client,setClient]=useState<RTKClient>();const[active,setActive]=useState(false);const[camera,setCamera]=useState(false);const[contentSource,setContentSource]=useState<"file"|"web"|"whiteboard">();const[localTrack,setLocalTrack]=useState<MediaStreamTrack>();const[target,setTarget]=useState<Element|null>(null);const clientRef=useRef<RTKClient|undefined>(undefined);const joiningRef=useRef<Promise<RTKClient|undefined>|undefined>(undefined);const sharingRef=useRef(false);const cameraRef=useRef(false);const localTrackRef=useRef<MediaStreamTrack|undefined>(undefined);
  const signal=useCallback(async(value:boolean)=>{if(!manager)return;await fetch(`${apiBase}/${code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"screen-share",value}),keepalive:!value}).catch(()=>undefined);setActive(value)},[apiBase,code,manager]);
  const releaseTrack=useCallback(()=>{const track=localTrackRef.current;localTrackRef.current=undefined;setLocalTrack(undefined);if(track?.readyState==="live")track.stop()},[]);
  const leave=useCallback(async()=>{const current=clientRef.current;clientRef.current=undefined;setClient(undefined);releaseTrack();if(current)await current.leave().catch(()=>undefined)},[releaseTrack]);
  const connect=useCallback(async()=>{if(clientRef.current?.self.roomJoined)return clientRef.current;if(joiningRef.current)return joiningRef.current;joiningRef.current=(async()=>{const response=await fetch(`${apiBase}/${code}/join`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName,screenShareCompanion:true})});const data=await response.json().catch(()=>({}))as{authToken?:string;error?:string};if(!response.ok||!data.authToken)throw new Error(data.error||"SCREEN_SHARE_COMPANION_FAILED");const next=await RTKClient.init({authToken:data.authToken,defaults:{audio:false,video:false}});await next.join();if(manager)await ensureCompanionStage(next);await next.self.disableAudio().catch(()=>undefined);await next.self.disableVideo().catch(()=>undefined);clientRef.current=next;setClient(next);return next})().catch(issue=>{onError(issue instanceof Error?issue.message:"Unable to join screen sharing");return undefined}).finally(()=>{joiningRef.current=undefined});return joiningRef.current},[apiBase,code,displayName,manager,onError]);
  useEffect(()=>setTarget(document.querySelector(".class-room-controls")?.parentElement||document.body),[]);
  useEffect(()=>{let cancelled=false;const poll=async()=>{const response=await fetch(`${apiBase}/${code}/media`,{cache:"no-store"}).catch(()=>null);const data=response?.ok?await response.json().catch(()=>({}))as{screenShareActive?:boolean}:{};if(cancelled)return;const next=Boolean(data.screenShareActive);setActive(next);if(next&&!clientRef.current)await connect();if(!next&&clientRef.current&&!sharingRef.current&&!cameraRef.current)await leave()};void poll();const timer=window.setInterval(()=>void poll(),3000);return()=>{cancelled=true;window.clearInterval(timer)}},[apiBase,code,connect,leave]);
  useEffect(()=>{if(!sharingRef.current&&!cameraRef.current)return;const timer=window.setInterval(()=>void signal(true),5000);return()=>window.clearInterval(timer)},[active,signal]);useEffect(()=>()=>{if(sharingRef.current||cameraRef.current)void signal(false);void leave()},[leave,signal]);
  const sharingChange=useCallback((sharing:boolean)=>{sharingRef.current=sharing;if(sharing&&cameraRef.current){const current=clientRef.current;cameraRef.current=false;setCamera(false);setContentSource(undefined);releaseTrack();void current?.self.disableVideo().catch(()=>undefined)}void signal(sharing||cameraRef.current);if(!sharing&&!cameraRef.current)window.setTimeout(()=>void leave(),250)},[leave,releaseTrack,signal]);
  const toggleCamera=useCallback(async()=>{try{if(cameraRef.current&&camera){const current=clientRef.current;if(current)await current.self.disableVideo();cameraRef.current=false;setCamera(false);releaseTrack();if(!sharingRef.current){await signal(false);await leave()}}else{const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:true}),track=stream.getVideoTracks()[0];if(!track)throw new Error("CAMERA_TRACK_UNAVAILABLE");const current=await connect();if(!current){track.stop();return}if(sharingRef.current){await current.self.disableScreenShare();sharingRef.current=false}if(cameraRef.current)await current.self.disableVideo().catch(()=>undefined);releaseTrack();current.self.setName(`${displayName} · Camera`);await current.self.enableVideo(track);localTrackRef.current=track;setLocalTrack(track);cameraRef.current=true;setCamera(true);setContentSource(undefined);await signal(true)}onError("")}catch{releaseTrack();cameraRef.current=false;setCamera(false);onError(lang==="zh"?"无法使用摄像头。请检查摄像头权限。":"Could not use the camera. Check camera permission.")}},[camera,connect,displayName,lang,leave,onError,releaseTrack,signal]);
  const publishContent=useCallback(async(track:MediaStreamTrack,source:"file"|"web"|"whiteboard")=>{const current=await connect();if(!current){track.stop();throw new Error("CONTENT_SHARE_CONNECTION_FAILED")}if(sharingRef.current){await current.self.disableScreenShare();sharingRef.current=false}if(cameraRef.current)await current.self.disableVideo().catch(()=>undefined);releaseTrack();current.self.setName(`${displayName} · ${source==="whiteboard"?"Whiteboard":source==="file"?"File":"Web"}`);await current.self.enableVideo(track);localTrackRef.current=track;setLocalTrack(track);cameraRef.current=true;setCamera(false);setContentSource(source);await signal(true)},[connect,displayName,releaseTrack,signal]);
  const stopContent=useCallback(async()=>{const current=clientRef.current;if(current)await current.self.disableVideo().catch(()=>undefined);cameraRef.current=false;setContentSource(undefined);releaseTrack();if(!sharingRef.current){await signal(false);await leave()}},[leave,releaseTrack,signal]);
  return <><ClassScreenShareButton client={client} manager={manager} lang={lang} onError={onError} ensurePublisher={connect} onSharingChange={sharingChange}/>{manager?<button className={camera?"on class-screen-share-button class-camera-share-button":"class-screen-share-button class-camera-share-button"} onClick={()=>void toggleCamera()} aria-label={lang==="zh"?(camera?"关闭共享摄像头":"共享摄像头"):(camera?"Stop camera share":"Share camera")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="12" height="10" rx="2"/><path d="m15 10 5-3v10l-5-3z"/></svg></button>:null}<ContentShareStudio code={code} apiBase={apiBase} locale={lang} enabled={manager} activeSource={contentSource} onPublish={publishContent} onStop={stopContent}/>{client&&active&&target?createPortal(<><ClassScreenShareStage client={client} lang={lang} listening={listening}/><ClassCompanionCameraStage client={client} lang={lang} localTrack={localTrack}/></>,target):null}</>;
}

function ClassCompanionCameraStage({client,lang,localTrack}:{client:RTKClient;lang:Lang;localTrack?:MediaStreamTrack}){
  const[revision,setRevision]=useState(0),[discovered,setDiscovered]=useState<ScreenPeer[]>([]);
  useEffect(()=>{const timer=window.setInterval(()=>setRevision(value=>value+1),500);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{let cancelled=false;const discover=async()=>{try{const peers=await client.participants.getAllJoinedPeers("",100,0)as unknown as ScreenPeer[];if(cancelled)return;const remote=peers.filter(peer=>peer.id!==client.self.id);setDiscovered(remote);if(remote.length)await client.participants.subscribe(remote.map(peer=>peer.id),["video"]);setRevision(value=>value+1)}catch{}};void discover();const timer=window.setInterval(()=>void discover(),1000);return()=>{cancelled=true;window.clearInterval(timer)}},[client]);
  const cameras=useMemo(()=>{void revision;const items:Array<{id:string;name:string;track:MediaStreamTrack;local:boolean}>=[];const selfTrack=localTrack||client.self.videoTrack;if(client.self.videoEnabled&&selfTrack)items.push({id:"self",name:client.self.name||"You",track:selfTrack,local:true});const peers=new Map<string,ScreenPeer>();for(const peer of discovered)peers.set(peer.id,peer);for(const map of[client.participants.all,client.participants.joined,client.participants.active,client.participants.videoSubscribed])for(const peer of map.toArray()as unknown as ScreenPeer[])if(peer.id!==client.self.id)peers.set(peer.id,peer);const ids=[...peers.keys()];if(ids.length)void client.participants.subscribe(ids,["video"]).catch(()=>undefined);for(const id of ids){const peer=(client.participants.videoSubscribed.get(id)||client.participants.active.get(id)||client.participants.joined.get(id)||client.participants.all.get(id)||peers.get(id))as unknown as ScreenPeer|undefined;if(peer?.videoEnabled&&peer.videoTrack)items.push({id:peer.id,name:peer.name||"Participant",track:peer.videoTrack,local:false})}return items},[client,discovered,localTrack,revision]);
  if(!cameras.length)return null;
  return <section className="class-screen-share-stage" aria-label={lang==="zh"?"共享内容":"Shared content"}><header><strong>{lang==="zh"?"正在共享内容":"Content sharing"}</strong><span>{cameras.length}</span></header>{cameras.map(item=><CompanionCameraPlayer key={item.id} item={item}/>)}</section>
}
function CompanionCameraPlayer({item}:{item:{name:string;track:MediaStreamTrack;local:boolean}}){const ref=useRef<HTMLVideoElement>(null);useEffect(()=>{const video=ref.current;if(!video)return;video.srcObject=new MediaStream([item.track]);return()=>{video.srcObject=null}},[item.track]);const match=item.name.match(/ · (Camera|File|Web|Whiteboard)$/u),label=item.name.replace(/ · (?:Screen|Camera|File|Web|Whiteboard)$/u,"");return <div className="class-screen-share-player"><video ref={ref} autoPlay playsInline muted={item.local}/><span>{label} · {match?.[1]||"Camera"}</span></div>}

export function ClassVideoContentShare({client,code,identity,mic,manager,lang,onError,apiBase="/api/classes"}:{client:RTKClient;code:string;identity:string;mic:boolean;manager:boolean;lang:Lang;onError:(message:string)=>void;apiBase?:string}){
  const[source,setSource]=useState<"file"|"web"|"whiteboard">();
  const trackRef=useRef<MediaStreamTrack|undefined>(undefined);
  const publish=useCallback(async(track:MediaStreamTrack,next:"file"|"web"|"whiteboard")=>{try{const approval=await fetch(`${apiBase}/${code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"media",identity,mic,camera:true})});if(!approval.ok)throw new Error("CONTENT_SHARE_NOT_ALLOWED");const previous=client.self.videoTrack;if(client.self.videoEnabled)await client.self.disableVideo();if(previous?.readyState==="live")previous.stop();if(trackRef.current?.readyState==="live")trackRef.current.stop();await client.self.enableVideo(track);trackRef.current=track;setSource(next);onError("")}catch{track.stop();onError(lang==="zh"?"无法开始内容共享。":"Could not start content sharing.");throw new Error("CONTENT_SHARE_FAILED")}},[apiBase,client,code,identity,lang,mic,onError]);
  const stop=useCallback(async()=>{if(client.self.videoEnabled)await client.self.disableVideo().catch(()=>undefined);if(trackRef.current?.readyState==="live")trackRef.current.stop();trackRef.current=undefined;setSource(undefined);await fetch(`${apiBase}/${code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"media",identity,mic,camera:false}),keepalive:true}).catch(()=>undefined)},[apiBase,client,code,identity,mic]);
  useEffect(()=>()=>{if(trackRef.current?.readyState==="live")trackRef.current.stop()},[]);
  return <ContentShareStudio code={code} apiBase={apiBase} locale={lang} enabled={manager} activeSource={source} onPublish={publish} onStop={stop}/>;
}
