import { notFound } from "next/navigation";
import CryptoCheckout from "@/components/CryptoCheckout";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { CryptoPlanId } from "@/lib/crypto-contract";
const validPlans=new Set<CryptoPlanId>(["basic","intermediate","advanced"]);
export const dynamic="force-dynamic";
export default async function CryptoPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{plan?:string}>}){const{lang}=await params,{plan}=await searchParams;if(lang!=="en"&&lang!=="zh")notFound();const initialPlan=validPlans.has(plan as CryptoPlanId)?plan as CryptoPlanId:"basic";return <main className="dashboard-page"><SiteHeader lang={lang}/><CryptoCheckout lang={lang} initialPlan={initialPlan}/><SiteFooter lang={lang}/></main>;}
