export function speakLearningText(text:string,locale:string,requestedRate=.9,onEnd?:()=>void){
  if(typeof window==="undefined"||!("speechSynthesis" in window)){onEnd?.();return()=>undefined;}
  const synth=window.speechSynthesis;synth.cancel();
  const utterance=new SpeechSynthesisUtterance(text),slow=requestedRate<=.6;
  utterance.lang=locale||"en-US";
  utterance.rate=slow ? .42 : Math.max(.75,Math.min(1,requestedRate));
  utterance.pitch=slow ? .88 : 1;
  const language=utterance.lang.slice(0,2).toLowerCase(),voice=synth.getVoices().find(item=>item.lang.toLowerCase().startsWith(language));
  if(voice)utterance.voice=voice;
  let settled=false;const finish=()=>{if(settled)return;settled=true;onEnd?.();};utterance.onend=finish;utterance.onerror=finish;
  const timer=window.setTimeout(()=>{synth.resume();synth.speak(utterance);},80);
  return()=>{window.clearTimeout(timer);synth.cancel();};
}
