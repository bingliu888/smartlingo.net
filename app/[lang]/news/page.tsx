import { notFound } from "next/navigation";
import { EditorialPage } from "../../../components/EditorialPage";
import { fallbackNews, getEditorialDocument } from "../../../lib/editorial-content";

export const dynamic = "force-dynamic";

export default async function NewsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const zh = lang === "zh";
  const document = await getEditorialDocument("news", fallbackNews);
  return <EditorialPage kind="news" lang={lang === "zh" ? "zh" : "en"} editionDate={document.editionDate} eyebrow={zh ? "SMARTLINGO 动态" : "SMARTLINGO NEWS"} title={zh ? "了解语言路径、课程与学习社区的新进展。" : "See what is moving forward across language paths, courses, and Community."} intro={zh ? "关注词汇、阅读、写作、听力、对话五项训练、会员自主开班、人工智能导师、实时语音与公开项目计划的重要进展。" : "Follow meaningful progress across five-skill practice, member-led courses, the AI Guru, live audio, and the public roadmap."} cards={document[lang === "zh" ? "zh" : "en"]}/>;
}
