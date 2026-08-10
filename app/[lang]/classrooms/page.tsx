import { LiveClassSiteFrame } from "@/components/live-class-site-frame";
import { LiveClassDirectory } from "@/components/live-class-directory";
import "./classrooms.css";

export const dynamic = "force-dynamic";
export default async function ClassesPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{view?:string}>}) {
  const [{lang},{view}]=await Promise.all([params,searchParams]);
  const locale=lang==="zh"?"zh":"en";
  return <LiveClassSiteFrame lang={locale}><LiveClassDirectory initialView={view||"public"} basePath={`/${locale}/classrooms`}/></LiveClassSiteFrame>;
}
