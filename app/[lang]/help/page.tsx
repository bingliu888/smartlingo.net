import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ensureHelpRoom } from "@/lib/help-room";

export const dynamic="force-dynamic";
export default async function HelpPage({params}:{params:Promise<{lang:string}>}){
  const {lang}=await params,locale=lang==="zh"?"zh":"en";
  const user=await getSessionUser();
  if(!user)redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/help`)}`);
  const code=await ensureHelpRoom();
  if(!code)throw new Error("HELP_ROOM_UNAVAILABLE");
  redirect(`/${locale}/classrooms/${code}/room`);
}
