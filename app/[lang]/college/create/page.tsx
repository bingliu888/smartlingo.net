import { notFound, redirect } from "next/navigation";
import { CollegeCreateForm } from "../../../../components/CollegeAdminForms";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { requestUser } from "../../../../lib/request-user";
import { activeCollegeTags, canCreateCollege } from "../../../../lib/smartlingo-colleges";

export default async function CreateCollegePage({params}:{params:Promise<{lang:string}>}){const{lang}=await params;if(lang!=="en"&&lang!=="zh"&&lang!=="es"&&lang!=="ja"&&lang!=="ko"&&lang!=="fr"&&lang!=="de"&&lang!=="ru"&&lang!=="it"&&lang!=="pt"&&lang!=="ar"&&lang!=="hi")notFound();const user=await requestUser();if(!user)redirect(`/${lang}/auth/login?returnTo=/${lang}/college/create`);if(!await canCreateCollege(user))redirect(`/${lang}/colleges/mine`);const tags=await activeCollegeTags();return <main className="college-form-page" data-layout-page="college-create" data-layout-ready="true"><SiteHeader lang={lang as any}/><section data-layout-fill="college-create-form"><p className="section-kicker">CREATE COLLEGE</p><h1>{lang==="zh"?"创建学院":"Create college"}</h1><p>{lang==="zh"?"创建后会自动建立导论课程；您可以继续把现有 SmartLingo 课程加入课程表。":"An introductory course is created automatically; you can then add existing SmartLingo courses to its course table."}</p><CollegeCreateForm lang={lang as any} tags={tags}/></section><SiteFooter lang={lang as any}/></main>;}
