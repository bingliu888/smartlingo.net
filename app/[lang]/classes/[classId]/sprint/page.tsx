import { notFound, redirect } from "next/navigation";
import { DailySprint } from "../../../../../components/DailySprint";
import { SiteFooter } from "../../../../../components/SiteFooter";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { requestUser } from "../../../../../lib/request-user";
export default async function SprintPage({params,searchParams}:{params:Promise<{lang:string;classId:string}>;searchParams:Promise<{minutes?:string}>}){const {lang,classId}=await params;if(lang!=="zh"&&lang!=="en")notFound();if(!await requestUser())redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/classes/${classId}/sprint`)}`);const query=await searchParams;const value=Number(query.minutes||10);const minutes=(value===5||value===15||value===20?value:10) as 5|10|15|20;return <main style={{background:"radial-gradient(circle at 85% 0,#c8ffe7,transparent 25%),#f7f3ea"}}><SiteHeader lang={lang}/><DailySprint lang={lang} classId={classId} durationMinutes={minutes}/><SiteFooter lang={lang}/></main>}
