import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { ShareStudio } from "../../../components/ShareStudio";
import { getSessionUser } from "../../../lib/auth";
import "./share.css";
export const dynamic="force-dynamic";
export default async function SharePage({params}:{params:Promise<{lang:string}>}){const {lang}=await params;if(lang!=="en"&&lang!=="zh")notFound();const h=await headers();const user=await getSessionUser(new Request("https://smartlingo.net",{headers:{cookie:h.get("cookie")??""}}));if(!user)redirect(`/${lang}/auth/login?returnTo=/${lang}/share`);return <main><SiteHeader lang={lang}/><ShareStudio lang={lang}/><SiteFooter lang={lang}/></main>}
