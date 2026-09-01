export const FILE_RANGE_CHUNK_BYTES=4*1024*1024;

export type BoundedByteRange={offset:number;length:number;status:200|206;contentRange?:string};

export function sourceLengthCoversRange(contentLength:string|null,offset:number,length:number){
  if(contentLength===null)return true;
  const size=Number(contentLength);
  return Number.isSafeInteger(size)&&size>=offset+length;
}

export function sliceByteStream(body:ReadableStream<Uint8Array>,offset:number,length:number){
  const reader=body.getReader();let skipped=0,remaining=length;
  return new ReadableStream<Uint8Array>({
    async pull(controller){
      try{
        while(remaining>0){
          const {done,value}=await reader.read();
          if(done){controller.error(new Error("Source ended before the selected byte range"));return;}
          if(!value?.byteLength)continue;
          let start=0;
          if(skipped<offset){const needed=offset-skipped;if(value.byteLength<=needed){skipped+=value.byteLength;continue;}start=needed;skipped=offset;}
          const take=Math.min(value.byteLength-start,remaining);
          if(take>0){controller.enqueue(value.subarray(start,start+take));remaining-=take;}
          if(remaining===0){await reader.cancel();controller.close();}
          return;
        }
      }catch(error){controller.error(error);}
    },
    cancel(reason){return reader.cancel(reason);},
  });
}

export function boundedByteRange(rangeHeader:string|null,size:number,maxBytes=FILE_RANGE_CHUNK_BYTES,forcePartial=false):BoundedByteRange|null {
  if(!Number.isSafeInteger(size)||size<1)return null;
  if(!rangeHeader){
    if(forcePartial&&size>maxBytes){
      const length=Math.min(size,maxBytes);
      return {offset:0,length,status:206,contentRange:`bytes 0-${length-1}/${size}`};
    }
    return {offset:0,length:size,status:200};
  }
  if(rangeHeader.includes(","))return null;
  const match=/^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if(!match||(match[1]===""&&match[2]===""))return null;
  let start:number;
  let end:number;
  if(match[1]===""){
    const suffix=Number(match[2]);
    if(!Number.isSafeInteger(suffix)||suffix<1)return null;
    start=Math.max(0,size-Math.min(size,suffix));
    end=size-1;
  }else{
    start=Number(match[1]);
    if(!Number.isSafeInteger(start)||start<0||start>=size)return null;
    end=match[2]===""?size-1:Number(match[2]);
    if(!Number.isSafeInteger(end)||end<start)return null;
    end=Math.min(end,size-1);
  }
  end=Math.min(end,start+maxBytes-1);
  const length=end-start+1;
  return {offset:start,length,status:206,contentRange:`bytes ${start}-${end}/${size}`};
}
