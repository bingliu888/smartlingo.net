import { notFound, redirect } from "next/navigation";
import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { LiveClassShareStudio } from "@/components/LiveClassShareStudio";
import { classAccess, classByCode } from "@/lib/live-classrooms";
import { getSessionUser } from "@/lib/auth";
import "../../classrooms.css";

export const dynamic = "force-dynamic";
export default async function ClassDetailPage({params}:{params:Promise<{lang:string;code:string}>}){
  const {lang,code}=await params,locale=lang==="zh"?"zh":"en",room=await classByCode(code);
  if(!room)notFound();
  const user=await getSessionUser();
  const access=await classAccess(room,user);
  if(!access.allowed){
    if("reason" in access&&access.reason==="VERIFIED_EMAIL_REQUIRED")
      redirect(`/${locale}/dashboard?notice=verify-email`);
    redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/classrooms/${code}`)}`);
  }
return <LiveClassSiteFrame lang={locale}><LiveClassShareStudio meeting={room} locale={locale} shareUrl={"https://smartlingo.net/" + locale + "/classrooms/" + room.code} embedded/></LiveClassSiteFrame>;
}
