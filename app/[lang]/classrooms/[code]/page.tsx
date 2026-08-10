import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getSessionUser } from "@/lib/auth";
import "../classrooms.css";

export const dynamic = "force-dynamic";
export default async function ClassDetailPage({params}:{params:Promise<{lang:string;code:string}>}){
  const {lang,code}=await params,locale=lang==="zh"?"zh":"en",room=await classByCode(code);
  if(!room)notFound();
  const access=await classAccess(room,await getSessionUser());
  if(!access.allowed)redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/classrooms/${code}`)}`);
  return <LiveClassSiteFrame lang={locale}><main className="class-detail-page"><section className="class-detail-copy"><p>CLASS · {room.code}</p><h1>{room.title}</h1><span>{room.description||"The teacher has not added a description."}</span><dl><div><dt>Teacher</dt><dd>{room.hostName}</dd></div><div><dt>Type</dt><dd>{room.classType}</dd></div><div><dt>Streaming</dt><dd>{room.streamingMode==="audio"?"Audio":"Audio / Video"}</dd></div><div><dt>Schedule</dt><dd>{new Date(room.startsAt*1000).toLocaleString()}</dd></div></dl><Link className="class-enter-room" href={`/${locale}/classrooms/${room.code}/room`} data-en="Enter Classroom →" data-zh="进入课堂 →">Enter Classroom →</Link></section><aside><i className={room.streamActive?"live":""}/><h2>{room.streamActive?"Live classroom":"Classroom ready"}</h2><p>Entering does not request microphone or camera permission. If streaming is live, you join as a viewer automatically.</p></aside></main></LiveClassSiteFrame>;
}
