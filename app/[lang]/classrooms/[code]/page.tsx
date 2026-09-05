import { notFound, redirect } from "next/navigation";
import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { ClassDetailExperience } from "@/components/class-detail-experience";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getSessionUser } from "@/lib/auth";
import "../classrooms.css";

export const dynamic = "force-dynamic";
export default async function ClassDetailPage({params}:{params:Promise<{lang:string;code:string}>}){
  const {lang,code}=await params,locale=lang==="zh"?"zh":"en",room=await classByCode(code);
  if(!room)notFound();
  const user=await getSessionUser();
  const access=await classAccess(room,user);
  if(!access.allowed&&room.classType==="private")notFound();
  if("reason" in access&&access.reason==="VERIFIED_EMAIL_REQUIRED")
    redirect(`/${locale}/dashboard?notice=verify-email`);
  return <LiveClassSiteFrame lang={locale}><ClassDetailExperience room={room} initialDisplayName={user?.displayName || ""} locale={locale} mediaBase="/api/classrooms" roomHref={`/${locale}/classrooms/${room.code}/room`} manager={access.manager} accessReason={"reason" in access?access.reason:undefined}/></LiveClassSiteFrame>;
}
