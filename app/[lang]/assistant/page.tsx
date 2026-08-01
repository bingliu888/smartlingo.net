import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/SiteHeader";
import { AssistantClient } from "../../../components/AssistantClient";
import "./composer-bottom.css";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  return <main className="assistant-page"><SiteHeader lang={lang}/><AssistantClient lang={lang}/></main>;
}
