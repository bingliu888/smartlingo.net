/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { meetingSpeechChunks, meetingSpeechScriptName, meetingSpeechText, MAX_MEETING_SPEECH_TEXT_BYTES } from "@/lib/meeting-speech-text";
import { MAX_AUDIO_FILE_SECONDS, MAX_AUDIO_NOTE_BYTES, MAX_BROWSER_RECORDING_SECONDS } from "@/lib/class-room-audio-note-policy";

type Material={id:string;fileName:string;contentType:string;fileSizeBytes:number;createdAt:number};
type AudioNote={id:string;contentType:string;byteSize:number;recordingSeconds:number;source:string;createdAt:number};
type Draft={blob:Blob;url:string;seconds:number;source:"browser"|"file"};
type Props={code:string;lang:"en"|"zh";manager:boolean;roomTabId:string;selfStreaming:boolean;
  panel:"recordings"|"files"|null;onClose:()=>void;onLocalNoteBusyChange?:(busy:boolean)=>void;
  providerRecordings?:Array<{id:string;status:string;recordingSeconds:number;createdAt:number}>;
  providerRecordingActive?:boolean;providerRecordingBusy?:boolean;onProviderRecording?:(action:"start"|"stop")=>void;
  onDeleteProviderRecording?:(id:string)=>void;};

export function ClassRoomResources({code,lang,manager,roomTabId,selfStreaming,panel,onClose,onLocalNoteBusyChange,
  providerRecordings=[],providerRecordingActive=false,providerRecordingBusy=false,onProviderRecording,onDeleteProviderRecording}:Props){
  const [materials,setMaterials]=useState<Material[]>([]),[notes,setNotes]=useState<AudioNote[]>([]),
    [canAdd,setCanAdd]=useState(false),[busy,setBusy]=useState(false),[menu,setMenu]=useState(false),
    [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),
    [draft,setDraft]=useState<Draft|null>(null),[editing,setEditing]=useState(false),
    [speechText,setSpeechText]=useState(""),[speaking,setSpeaking]=useState<string|null>(null),
    [message,setMessage]=useState("");
  const materialInput=useRef<HTMLInputElement>(null),audioInput=useRef<HTMLInputElement>(null),textInput=useRef<HTMLInputElement>(null),
    recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),chunks=useRef<Blob[]>([]),
    started=useRef(0),speechToken=useRef(0);
  const zh=lang==="zh";
  useEffect(()=>{onLocalNoteBusyChange?.(recording||Boolean(draft)||editing||busy);},[busy,draft,editing,onLocalNoteBusyChange,recording]);
  const stopSpeech=useCallback(()=>{speechToken.current++;window.speechSynthesis?.cancel();setSpeaking(null);},[]);
  useEffect(()=>()=>{if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());stopSpeech();},[stopSpeech]);
  useEffect(()=>()=>{if(draft)URL.revokeObjectURL(draft.url);},[draft]);
  useEffect(()=>{if(panel!=="recordings")stopSpeech();setMenu(false);},[panel,stopSpeech]);
  useEffect(()=>{if(!selfStreaming)return;setMenu(false);},[selfStreaming]);
  useEffect(()=>{if(!recording)return;const tick=()=>{const elapsed=Math.floor((Date.now()-started.current)/1000);setSeconds(Math.min(elapsed,MAX_BROWSER_RECORDING_SECONDS));if(elapsed>=MAX_BROWSER_RECORDING_SECONDS&&recorder.current?.state==="recording")recorder.current.stop();};tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[recording]);
  const load=useCallback(async()=>{
    const [files,audio]=await Promise.all([fetch(`/api/classrooms/${code}/materials`,{cache:"no-store"}),fetch(`/api/classrooms/${code}/audio-notes`,{cache:"no-store"})]);
    if(!files.ok||!audio.ok)throw new Error(zh?"无法载入文件列表":"Unable to load files");
    const f=await files.json() as {materials:Material[]},a=await audio.json() as {items:AudioNote[];canAdd:boolean};
    setMaterials(f.materials||[]);setNotes(a.items||[]);setCanAdd(a.canAdd);
  },[code,zh]);
  useEffect(()=>{if(!panel)return;void load().catch(error=>setMessage(String(error)));},[panel,load]);
  async function uploadMaterial(file?:File){if(!file||busy)return false;setBusy(true);setMessage("");try{
    const response=await fetch(`/api/classrooms/${code}/materials`,{method:"POST",headers:{"content-type":file.type||"application/octet-stream","x-file-name":encodeURIComponent(file.name),"x-file-size":String(file.size)},body:file});
    if(!response.ok)throw new Error(((await response.json().catch(()=>({}))) as {error?:string}).error||"Upload failed");await load();return true;
  }catch(error){setMessage(error instanceof Error?error.message:String(error));return false;}finally{setBusy(false);}}
  async function uploadAudio(blob:Blob,duration:number,source:"browser"|"file"){
    if(blob.size<1||blob.size>MAX_AUDIO_NOTE_BYTES){setMessage(zh?"音频不能超过 100 MB":"Audio must be at most 100 MB");return;}
    setBusy(true);setMessage("");try{
      const response=await fetch(`/api/classrooms/${code}/audio-notes`,{method:"POST",headers:{"content-type":blob.type||"audio/webm","x-recording-seconds":String(duration),"x-recording-source":source,"x-recording-size":String(blob.size),"x-room-tab-id":roomTabId},body:blob});
      if(response.status===402){window.location.assign(`/${lang}/pricing`);return;}
      if(!response.ok)throw new Error(((await response.json().catch(()=>({}))) as {error?:string}).error||"Upload failed");
      setDraft(null);await load();
    }catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  async function selectAudio(file?:File){if(!file)return;if(!file.type.startsWith("audio/")||file.size>MAX_AUDIO_NOTE_BYTES){setMessage(zh?"请选择 100 MB 以内的音频":"Choose audio up to 100 MB");return;}
    const url=URL.createObjectURL(file);try{const duration=await new Promise<number>((resolve,reject)=>{const audio=new Audio();const timer=setTimeout(()=>reject(new Error("timeout")),10000);audio.onloadedmetadata=()=>{clearTimeout(timer);resolve(audio.duration);};audio.onerror=()=>{clearTimeout(timer);reject(new Error("invalid"));};audio.src=url;});
      if(!Number.isFinite(duration)||duration<=0||duration>MAX_AUDIO_FILE_SECONDS)throw new Error("duration");setDraft({blob:file,url,seconds:Math.ceil(duration),source:"file"});
    }catch{URL.revokeObjectURL(url);setMessage(zh?"音频应在 30 分钟以内，且可读取时长":"Audio must have a readable duration of at most 30 minutes");}}
  async function startRecording(){if(typeof MediaRecorder==="undefined"||!navigator.mediaDevices?.getUserMedia){setMessage(zh?"浏览器不支持录音":"Recording is unavailable");return;}
    setMenu(false);setBusy(true);try{const media=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      const mime=["audio/mp4","audio/webm;codecs=opus","audio/webm"].find(type=>MediaRecorder.isTypeSupported(type));
      const device=new MediaRecorder(media,mime?{mimeType:mime}:undefined);stream.current=media;recorder.current=device;chunks.current=[];
      device.ondataavailable=event=>{if(event.data.size)chunks.current.push(event.data);if(chunks.current.reduce((sum,part)=>sum+part.size,0)>MAX_AUDIO_NOTE_BYTES&&device.state==="recording"){chunks.current=[];device.stop();setMessage(zh?"录音超过 100 MB":"Recording exceeded 100 MB");}};
      device.onstop=()=>{media.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks.current,{type:device.mimeType||"audio/webm"});if(blob.size)setDraft({blob,url:URL.createObjectURL(blob),seconds:Math.max(1,Math.min(MAX_BROWSER_RECORDING_SECONDS,Math.ceil((Date.now()-started.current)/1000))),source:"browser"});else setMessage(zh?"录音为空":"Recording is empty");stream.current=null;recorder.current=null;chunks.current=[];setRecording(false);};
      device.onerror=()=>{media.getTracks().forEach(track=>track.stop());setRecording(false);setMessage(zh?"录音失败":"Recording failed");};
      device.start(1000);started.current=Date.now();setSeconds(0);setRecording(true);
    }catch{setMessage(zh?"无法取得麦克风权限":"Microphone access unavailable");}finally{setBusy(false);}}
  async function submitText(){const text=meetingSpeechText(speechText);if(!text){setMessage(zh?"请输入 5000 字以内的文字":"Enter up to 5,000 characters");return;}
    const iso=new Date().toISOString(),name=`speech-${iso.slice(0,10).replaceAll("-","")}-${iso.slice(11,19).replaceAll(":","")}.txt`;
    if(await uploadMaterial(new File([text],name,{type:"text/plain"}))){setEditing(false);setSpeechText("");}}
  async function speak(item:Material){if(speaking===item.id){stopSpeech();return;}if(!window.speechSynthesis){setMessage(zh?"浏览器不支持文字朗读":"Speech synthesis unavailable");return;}
    stopSpeech();const token=speechToken.current;try{const response=await fetch(`/api/classrooms/${code}/materials/${item.id}`,{cache:"no-store"});if(!response.ok)throw new Error("File unavailable");
      const value=meetingSpeechText(new TextDecoder("utf-8",{fatal:true}).decode(await response.arrayBuffer()));if(!value)throw new Error("Invalid text");setSpeaking(item.id);window.speechSynthesis.resume();
      const parts=meetingSpeechChunks(value);const next=(index:number)=>{if(token!==speechToken.current)return;if(index>=parts.length){setSpeaking(null);return;}
        const utterance=new SpeechSynthesisUtterance(parts[index]);utterance.lang=lang==="zh"?"zh-CN":"en-US";utterance.onend=()=>next(index+1);utterance.onerror=()=>setSpeaking(null);window.speechSynthesis.speak(utterance);};next(0);
    }catch(error){setMessage(error instanceof Error?error.message:String(error));setSpeaking(null);}}
  async function remove(kind:"material"|"audio-note",id:string){if(!window.confirm(zh?"删除此文件？":"Delete this file?"))return;
    setBusy(true);try{const route=kind==="material"?"materials":"audio-notes";const response=await fetch(`/api/classrooms/${code}/${route}/${id}`,{method:"DELETE"});if(!response.ok)throw new Error("Delete failed");await load();}catch(error){setMessage(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  if(!panel)return null;
  const scripts=materials.filter(item=>item.contentType==="text/plain"&&item.fileSizeBytes<=MAX_MEETING_SPEECH_TEXT_BYTES&&meetingSpeechScriptName(item.fileName));
  return <aside className="class-room-drawer" role="dialog" aria-label={panel==="recordings"?(zh?"全部录音":"All recordings"):(zh?"全部附件":"All attachments")}>
    <header><h2>{panel==="recordings"?(zh?"全部录音":"All recordings"):(zh?"全部附件":"All attachments")}</h2><div className="class-room-drawer-actions">
      {panel==="recordings"&&manager&&!selfStreaming&&!recording&&!draft&&!editing&&<button type="button" disabled={busy} aria-label={zh?"添加录音":"Add recording"} onClick={()=>{if(!canAdd){window.location.assign(`/${lang}/pricing`);return;}setMenu(!menu);}}>＋</button>}
      {panel==="files"&&manager&&<button type="button" disabled={busy} aria-label={zh?"添加附件":"Add attachment"} onClick={()=>materialInput.current?.click()}>＋</button>}
      <button type="button" disabled={recording} onClick={onClose} aria-label={zh?"关闭":"Close"}>×</button></div></header>
    <input ref={materialInput} hidden type="file" accept="application/pdf,text/plain,image/jpeg,image/png,image/webp,text/csv,text/markdown" onChange={event=>{void uploadMaterial(event.target.files?.[0]);event.target.value="";}}/>
    <input ref={audioInput} hidden type="file" accept="audio/*" onChange={event=>{void selectAudio(event.target.files?.[0]);event.target.value="";}}/>
    <input ref={textInput} hidden type="file" accept=".txt,text/plain" onChange={async event=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;if(file.size>MAX_MEETING_SPEECH_TEXT_BYTES){setMessage(zh?"文件不能超过 20 KB":"Text file exceeds 20 KB");return;}const value=await file.text();setSpeechText(value.slice(0,5000));}}/>
    {message&&<p className="class-room-error" role="alert">{message}</p>}
    {menu&&panel==="recordings"&&<div className="class-room-upload-menu"><button type="button" onClick={()=>void startRecording()}>{zh?"开始录音":"Start recording"}</button><button type="button" onClick={()=>{setMenu(false);audioInput.current?.click();}}>{zh?"音频文件":"Audio file"}</button><button type="button" onClick={()=>{setMenu(false);setEditing(true);}}>{zh?"文字转语音":"Text to speech"}</button></div>}
    {recording&&<div className="class-room-recording-active" role="status"><span className="class-room-recording-pulse"/>{zh?"录音中":"Recording"} · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}<button type="button" onClick={()=>recorder.current?.stop()}>{zh?"停止":"Stop"}</button></div>}
    {draft&&<div className="class-room-recording-draft"><strong>{zh?"试听后上传":"Preview before uploading"} · {Math.floor(draft.seconds/60)}:{String(draft.seconds%60).padStart(2,"0")}</strong><audio controls src={draft.url}/><button type="button" disabled={busy} onClick={()=>void uploadAudio(draft.blob,draft.seconds,draft.source)}>{zh?"上传":"Upload"}</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>{zh?"丢弃":"Discard"}</button></div>}
    {editing&&<div className="class-room-speech-editor"><label>{zh?"文字转语音":"Text to speech"}<textarea value={speechText} maxLength={5000} onChange={event=>setSpeechText(event.target.value)} rows={5}/></label><small>{speechText.length}/5000</small><button type="button" onClick={()=>textInput.current?.click()}>{zh?"导入 .txt":"Import .txt"}</button><button type="button" disabled={busy} onClick={()=>void submitText()}>{zh?"提交":"Submit"}</button><button type="button" onClick={()=>setEditing(false)}>{zh?"取消":"Cancel"}</button></div>}
    <div className="class-room-drawer-list">
      {panel==="recordings"&&<>
        {scripts.map(item=><article key={item.id}><strong>{item.fileName}</strong><button type="button" onClick={()=>void speak(item)}>{speaking===item.id?"■":"▶"} {zh?"朗读":"Read aloud"}</button>{manager&&<button type="button" onClick={()=>void remove("material",item.id)}>{zh?"删除":"Delete"}</button>}</article>)}
        {notes.map(item=><article key={item.id}><strong>{new Date(item.createdAt*1000).toLocaleString(lang)}</strong><small>{Math.floor(item.recordingSeconds/60)}:{String(item.recordingSeconds%60).padStart(2,"0")}</small><audio controls preload="none" src={`/api/classrooms/${code}/audio-notes/${item.id}`}/>{manager&&<button type="button" onClick={()=>void remove("audio-note",item.id)}>{zh?"删除":"Delete"}</button>}</article>)}
        {providerRecordings.map(item=><article key={`provider-${item.id}`}><strong>{new Date(item.createdAt*1000).toLocaleString(lang)}</strong><small>{item.status==="ready"?`${Math.floor(item.recordingSeconds/60)} min`:item.status}</small>{item.status==="ready"&&<audio controls preload="none" src={`/api/classrooms/${code}/recording/${item.id}`}/ >}{manager&&onDeleteProviderRecording&&<button type="button" disabled={providerRecordingBusy} onClick={()=>onDeleteProviderRecording(item.id)}>{zh?"删除":"Delete"}</button>}</article>)}
        {manager&&onProviderRecording&&<button type="button" disabled={providerRecordingBusy} onClick={()=>onProviderRecording(providerRecordingActive?"stop":"start")}>{providerRecordingActive?(zh?"停止课程直播录制":"Stop course capture"):(zh?"开始课程直播录制":"Start course capture")}</button>}
        {!scripts.length&&!notes.length&&!providerRecordings.length&&<p>{zh?"还没有录音":"No recordings yet"}</p>}
      </>}
      {panel==="files"&&<>{materials.filter(item=>!meetingSpeechScriptName(item.fileName)).map(item=><article key={item.id}><strong>{item.fileName}</strong><small>{new Date(item.createdAt*1000).toLocaleString(lang)}</small><a href={`/api/classrooms/${code}/materials/${item.id}`} target="_blank" rel="noreferrer">{zh?"查看":"View"}</a>{manager&&<button type="button" onClick={()=>void remove("material",item.id)}>{zh?"删除":"Delete"}</button>}</article>)}{!materials.length&&<p>{zh?"还没有附件":"No attachments yet"}</p>}</>}
    </div>
  </aside>;
}
