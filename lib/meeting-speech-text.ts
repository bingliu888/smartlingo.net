export const MAX_MEETING_SPEECH_TEXT_CHARACTERS=5000;
export const MAX_MEETING_SPEECH_TEXT_BYTES=20*1024;

export function meetingSpeechText(value:string):string|null{
  const text=value.replace(/\r\n?/g,"\n").trim();
  if(!text||text.length>MAX_MEETING_SPEECH_TEXT_CHARACTERS||text.includes("\0"))return null;
  return text;
}

export function meetingSpeechScriptName(value:string):boolean{
  return /^speech-\d{8}-\d{6}\.txt$/i.test(value);
}

export function meetingSpeechChunks(text:string,maxCharacters=180):string[]{
  if(!Number.isSafeInteger(maxCharacters)||maxCharacters<1)throw new Error("INVALID_SPEECH_CHUNK_SIZE");
  const chunks:string[]=[];
  for(const sentence of text.match(/[^.!?。！？；;\n]+[.!?。！？；;\n]*/gu)||[text]){
    const characters=Array.from(sentence.trim());
    for(let offset=0;offset<characters.length;offset+=maxCharacters){
      const chunk=characters.slice(offset,offset+maxCharacters).join("").trim();
      if(chunk)chunks.push(chunk);
    }
  }
  return chunks;
}
