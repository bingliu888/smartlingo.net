import { notFound, redirect } from "next/navigation";
import { DailySprint } from "../../../../../components/DailySprint";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";
import { isPublicBeginnerSprintClassId } from "../../../../../lib/smartlingo-learning-access";
export default async function SprintPage({params,searchParams}:{params:Promise<{lang:string;classId:string}>;searchParams:Promise<{minutes?:string;source?:string}>}){const {lang,classId}=await params;if(lang!=="zh"&&lang!=="en")notFound();const query=await searchParams;const publicPlay=query.source==="play"||isPublicBeginnerSprintClassId(classId);if(!publicPlay&&!await requestUser())redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/classes/${classId}/sprint`)}`);const value=Number(query.minutes||10);const minutes=(value===5||value===15||value===20?value:10) as 5|10|15|20;return <main style={{background:"radial-gradient(circle at 85% 0,#c8ffe7,transparent 25%),#f7f3ea"}}><SiteHeader lang={lang as any}/><DailySprint lang={lang as any} classId={classId} durationMinutes={minutes} publicPlay={publicPlay}/><SiteFooter lang={lang as any}/></main>}
