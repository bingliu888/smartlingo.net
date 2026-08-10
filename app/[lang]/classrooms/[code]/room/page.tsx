import { notFound, redirect } from "next/navigation";
import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { LiveClassRoomClient } from "@/components/live-class-room-client";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getSessionUser } from "@/lib/auth";
import "../../classrooms.css";

export const dynamic = "force-dynamic";
export default async function ClassroomPage({params}:{params:Promise<{lang:string;code:string}>}){
  const {lang,code}=await params,locale=lang==="zh"?"zh":"en",room=await classByCode(code);
  if(!room)notFound();
  const user=await getSessionUser(),access=await classAccess(room,user);
  if(!access.allowed)redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/classrooms/${code}/room`)}`);
  return <LiveClassSiteFrame lang={locale}><main className="class-room-page"><LiveClassRoomClient room={{code:room.code,title:room.title,streamingMode:room.streamingMode,realtimeMode:room.realtimeMode,classType:room.classType}} displayName={user?.displayName||"Guest"} manager={access.manager} lang={locale}/></main></LiveClassSiteFrame>;
}
