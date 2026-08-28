import { notFound, redirect } from "next/navigation";
import { MyStudents } from "@/components/MyStudents";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { requestUser } from "@/lib/request-user";
import { courseSupervisorIdentity } from "@/lib/course-supervisors";
import { isInterfaceLanguage } from "@/lib/interface-locale";

export default async function MyStudentsPage({params}:{params:Promise<{lang:string}>}){const{lang}=await params;if(!isInterfaceLanguage(lang))notFound();const user=await requestUser();if(!user)redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/my-students`)}`);if(!await courseSupervisorIdentity(user.id,true))redirect(`/${lang}/dashboard`);return <main className="my-students-page"><SiteHeader lang={lang}/><MyStudents lang={lang}/><SiteFooter lang={lang}/></main>}
