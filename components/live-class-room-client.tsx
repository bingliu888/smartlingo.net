"use client";

import { RealtimeKitProvider, useRealtimeKitClient, useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { RtkParticipantsAudio as BaseParticipantsAudio } from "@cloudflare/realtimekit-react-ui";
import type RTKClient from "@cloudflare/realtimekit";
import { useCallback, useEffect, useRef, useState } from "react";

type Room={code:string;title:string;streamingMode:"audio"|"video";classType:"public"|"trial"|"private"};
type Media={streamActive:boolean;streamingMode:"audio"|"video";muteAll:boolean;users:Array<{identity:string;displayName:string;isMember:number;micOn:number;cameraOn:number}>};
type Message={id:string;senderName:string;body:string;createdAt:number};
type Role="viewer"|"member"|"host";

function RemoteVideo({peerId,name,onOpen,selected}:{peerId:string;name:string;onOpen:()=>void;selected:boolean}){
  const peer=useRealtimeKitSelector(current=>current.participants.videoSubscribed.get(peerId)||current.participants.active.get(peerId)) as {name?:string;videoTrack?:MediaStreamTrack;videoEnabled?:boolean}|undefined;
  const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const element=ref.current,track=peer?.videoTrack;if(!element||!track)return;element.srcObject=new MediaStream([track]);void element.play().catch(()=>undefined);return()=>{element.srcObject=null;}},[peer?.videoTrack]);
  if(!peer?.videoTrack||!peer.videoEnabled)return null;
  return <button className={`class-video-tile${selected?" selected":""}`} onClick={onOpen}><video ref={ref} autoPlay playsInline/><span>{peer.name||name}</span></button>;
}

function VideoGrid({localName}:{localName:string}){
  const local=useRealtimeKitSelector(current=>({enabled:current.self.videoEnabled,track:current.self.videoTrack})) as {enabled:boolean;track?:MediaStreamTrack};
  const peers=useRealtimeKitSelector(current=>current.participants.videoSubscribed.toArray().map(peer=>({id:peer.id,name:peer.name||"Participant",enabled:peer.videoEnabled}))) as Array<{id:string;name:string;enabled?:boolean}>;
  const ref=useRef<HTMLVideoElement>(null),[full,setFull]=useState<string|null>(null);
  useEffect(()=>{const element=ref.current,track=local.track;if(!element||!track)return;element.srcObject=new MediaStream([track]);void element.play().catch(()=>undefined);return()=>{element.srcObject=null;}},[local.track]);
  const visible=peers.filter(peer=>peer.enabled);
  if(!local.enabled&&!visible.length)return null;
  return <div className={`class-video-grid${full?" fullscreen":""}`} data-count={(local.enabled?1:0)+visible.length}>
    {local.enabled&&local.track&&<button className={`class-video-tile${full==="local"?" selected":""}`} onClick={()=>setFull("local")}><video ref={ref} autoPlay muted playsInline/><span>{localName}</span></button>}
    {visible.map(peer=><RemoteVideo key={peer.id} peerId={peer.id} name={peer.name} selected={full===peer.id} onOpen={()=>setFull(peer.id)}/>)}
    {full&&<button className="class-video-close" onClick={()=>setFull(null)} aria-label="Back to video tiles">▦</button>}
  </div>;
}

function ParticipantsAudio({client}:{client:RTKClient}){
  const[enabled,setEnabled]=useState(true),[blocked,setBlocked]=useState(false);
  useEffect(()=>{if(!enabled)return;const unlock=()=>setBlocked(false);window.addEventListener("pointerdown",unlock,{once:true});return()=>window.removeEventListener("pointerdown",unlock)},[enabled]);
  return <div className="class-listen-control"><button className={enabled?"on":""} onClick={()=>{setEnabled(value=>!value);setBlocked(false)}} aria-pressed={enabled}>{enabled?"🔊 Listening":"🔇 Listen"}</button>{blocked&&<span>Tap Listen to allow audio playback.</span>}{enabled&&<BaseParticipantsAudio meeting={client}/>}</div>;
}

function ConnectedRoom({client,room,identity,manager,displayName,role,mic,camera,onMedia,onLeave}:{client:RTKClient;room:Room;identity:string;manager:boolean;displayName:string;role:Role;mic:boolean;camera:boolean;onMedia:(mic:boolean,camera:boolean)=>Promise<void>;onLeave:()=>void}){
  const[media,setMedia]=useState<Media|null>(null),[messages,setMessages]=useState<Message[]>([]),[body,setBody]=useState(""),[error,setError]=useState("");
  const load=useCallback(async()=>{const[m,c]=await Promise.all([fetch(`/api/classrooms/${room.code}/media`,{cache:"no-store"}),fetch(`/api/classrooms/${room.code}/chat`,{cache:"no-store"})]);if(m.ok)setMedia(await m.json());if(c.ok)setMessages((await c.json()).messages||[]);await fetch(`/api/classrooms/${room.code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"heartbeat",identity})});},[identity,room.code]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),3000);return()=>window.clearInterval(timer)},[load]);
  async function change(nextMic:boolean,nextCamera:boolean){setError("");try{await onMedia(nextMic,nextCamera);await load()}catch(issue){setError(issue instanceof Error?issue.message:"Unable to change media")}}
  async function send(event:React.FormEvent){event.preventDefault();if(!body.trim())return;const response=await fetch(`/api/classrooms/${room.code}/chat`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body})});if(response.ok){setBody("");await load()}else setError("Sign in as a member to send messages.")}
  return <>
    <header className="class-room-controls"><div><i className="live"/><b>Live classroom</b><small>{role==="viewer"?"Viewer":media?.streamingMode==="audio"?"Audio":"Audio / Video"}</small></div><nav>
      <button className={mic?"on":""} onClick={()=>void change(!mic,camera)} aria-label="Microphone">🎙</button>
      {room.streamingMode==="video"&&<button className={camera?"on":""} onClick={()=>void change(mic,!camera)} aria-label="Camera">▣</button>}
      {manager&&room.classType!=="private"&&<button className={!media?.muteAll?"on":""} onClick={async()=>{await fetch(`/api/classrooms/${room.code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"mute-all",mic:!media?.muteAll})});await load()}}>{media?.muteAll?"Open media":"Mute all"}</button>}
      <button className="leave" onClick={onLeave}>Leave</button>
    </nav></header>
    {error&&<p className="class-room-error" role="alert">{error}</p>}
    <ParticipantsAudio client={client}/>
    {room.streamingMode==="video"&&<VideoGrid localName={displayName}/>} 
    <section className="class-chat"><header><h2>Class chat</h2><span>{media?.users.length||0} online</span></header><div>{messages.map(message=><article key={message.id}><b>{message.senderName}</b><p>{message.body}</p><small>{new Date(message.createdAt*1000).toLocaleTimeString()}</small></article>)}</div><form onSubmit={send}><textarea value={body} onChange={event=>setBody(event.target.value)} placeholder="Write a message…"/><button>Send</button></form></section>
  </>;
}

export function LiveClassRoomClient({room,displayName,manager}:{room:Room;displayName:string;manager:boolean}){
  const[client,initClient]=useRealtimeKitClient({resetOnLeave:true}),[joined,setJoined]=useState(false),[role,setRole]=useState<Role>("viewer"),[mic,setMic]=useState(false),[camera,setCamera]=useState(false),[identity]=useState(()=>crypto.randomUUID()),[error,setError]=useState(""),joining=useRef(false);
  const disconnect=useCallback(async(report=true)=>{const active=client;try{await active?.self.disableAudio();await active?.self.disableVideo();await active?.leave()}catch{}if(report)await fetch(`/api/classrooms/${room.code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"leave",identity}),keepalive:true}).catch(()=>undefined);setMic(false);setCamera(false);setJoined(false)},[client,identity,room.code]);
  const connect=useCallback(async({start=false,publish=false,nextMic=false,nextCamera=false}:{start?:boolean;publish?:boolean;nextMic?:boolean;nextCamera?:boolean}={})=>{if(joining.current)return;joining.current=true;setError("");try{if(client&&joined)await disconnect(false);const response=await fetch(`/api/classrooms/${room.code}/join`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({displayName,identity,start,publish})}),data=await response.json().catch(()=>({})) as {authToken?:string;role?:Role;error?:string};if(!response.ok||!data.authToken){if(data.error!=="STREAM_NOT_ACTIVE")setError(data.error||"Unable to connect");return}const next=await initClient({authToken:data.authToken,defaults:{audio:false,video:false}});await next?.join();await next?.self.disableAudio();await next?.self.disableVideo();if(nextMic||nextCamera){const approval=await fetch(`/api/classrooms/${room.code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"media",identity,mic:nextMic,camera:nextCamera})});if(!approval.ok)throw new Error(((await approval.json().catch(()=>({}))) as {error?:string}).error||"Media permission denied");if(nextMic)await next?.self.enableAudio();if(nextCamera)await next?.self.enableVideo()}setRole(data.role||"viewer");setMic(nextMic);setCamera(nextCamera);setJoined(true)}catch(issue){setError(issue instanceof Error?issue.message:"RealtimeKit connection failed.")}finally{joining.current=false}},[client,disconnect,displayName,identity,initClient,joined,room.code]);
  const changeMedia=useCallback(async(nextMic:boolean,nextCamera:boolean)=>{if(role==="viewer"&&(nextMic||nextCamera)){await connect({publish:true,nextMic,nextCamera});return}const response=await fetch(`/api/classrooms/${room.code}/media`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"media",identity,mic:nextMic,camera:nextCamera})});if(!response.ok)throw new Error(((await response.json().catch(()=>({}))) as {error?:string}).error||"Unable to change media");if(nextMic)await client?.self.enableAudio();else await client?.self.disableAudio();if(nextCamera)await client?.self.enableVideo();else await client?.self.disableVideo();setMic(nextMic);setCamera(nextCamera)},[client,connect,identity,role,room.code]);
  const leave=useCallback(async(navigate=true)=>{await disconnect(true);if(navigate)window.location.assign(`/classrooms/${room.code}`)},[disconnect,room.code]);
  useEffect(()=>{let alive=true;const check=async()=>{const response=await fetch(`/api/classrooms/${room.code}/media`,{cache:"no-store"});if(!alive||!response.ok)return;const state=await response.json() as Media;if(state.streamActive&&!joined&&!joining.current)void connect();if(!state.streamActive&&joined&&!manager)void disconnect(true)};void check();const poll=window.setInterval(()=>void check(),3000);const visible=()=>{if(document.visibilityState==="visible")void check()};document.addEventListener("visibilitychange",visible);return()=>{alive=false;window.clearInterval(poll);document.removeEventListener("visibilitychange",visible)}},[connect,disconnect,joined,manager,room.code]);
  useEffect(()=>{const cleanup=()=>{void disconnect(true)};window.addEventListener("pagehide",cleanup);return()=>window.removeEventListener("pagehide",cleanup)},[disconnect]);
  if(!joined||!client)return <section className="class-waiting"><span className="stream-spinner"/><h2>{manager?"Start the live classroom":"Waiting for live classroom"}</h2><p>{manager?"Start an independent SmartFi RealtimeKit session. Microphone and camera remain off until selected.":"You will join automatically as a viewer when streaming starts. No device permission is requested."}</p>{manager&&<button onClick={()=>void connect({start:true})}>Start live streaming</button>}{error&&<p role="alert">{error}</p>}</section>;
  return <RealtimeKitProvider value={client}><ConnectedRoom client={client} room={room} identity={identity} manager={manager} displayName={displayName} role={role} mic={mic} camera={camera} onMedia={changeMedia} onLeave={()=>void leave(true)}/></RealtimeKitProvider>;
}
