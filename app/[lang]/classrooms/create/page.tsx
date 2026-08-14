import { redirect } from "next/navigation";
import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { LiveClassCreateForm } from "@/components/live-class-create-form";
import { getSessionUser } from "@/lib/auth";
import { isAdminUser, isTeacherUser } from "@/lib/admin-access";
import "../classrooms.css";

export const dynamic = "force-dynamic";
export default async function CreateClassPage({params}:{params:Promise<{lang:string}>}){
  const {lang}=await params; const locale=lang==="zh"?"zh":"en";
  const user=await getSessionUser();
  if(!user)redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/classrooms/create`)}`);
  if(!await isTeacherUser(user))redirect(`/${locale}/classrooms`);
  return <LiveClassSiteFrame lang={locale}><LiveClassCreateForm basePath={`/${locale}/classrooms`}/></LiveClassSiteFrame>;
}
