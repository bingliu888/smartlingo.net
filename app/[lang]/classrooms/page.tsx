import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ClassesPage({params}:{params:Promise<{lang:string}>}) {
  const {lang}=await params;
  const locale=lang==="zh"?"zh":"en";
  redirect(`/${locale}/classes`);
}
