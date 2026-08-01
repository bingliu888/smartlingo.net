import { notFound } from "next/navigation";
import { EditorialPage } from "../../../components/EditorialPage";
import { fallbackNews, getEditorialDocument } from "../../../lib/editorial-content";

export const dynamic = "force-dynamic";

export default async function NewsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const zh = lang === "zh";
  const document = await getEditorialDocument("news", fallbackNews);
  return <EditorialPage kind="news" lang={lang} editionDate={document.editionDate} eyebrow={zh ? "SMARTLINGO 动态" : "SMARTLINGO NEWS"} title={zh ? "了解语言路径、班级与学习社区的新进展。" : "See what is moving forward across language paths, classes, and Community."} intro={zh ? "关注词汇、阅读、写作、听力、对话五项训练、会员自主开班、人工智能导师、实时语音与公开项目计划的重要进展。" : "Follow meaningful progress across five-skill practice, member-led classes, the AI Guru, live audio, and the public roadmap."} cards={document[lang]}/>;
}
