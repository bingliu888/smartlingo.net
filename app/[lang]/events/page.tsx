import { notFound } from "next/navigation";
import { EditorialPage } from "../../../components/EditorialPage";
import { fallbackEvents, getEditorialDocument } from "../../../lib/editorial-content";

export const dynamic = "force-dynamic";

export default async function EventsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const zh = lang === "zh";
  const document = await getEditorialDocument("events", fallbackEvents);
  return <EditorialPage kind="events" lang={lang} editionDate={document.editionDate} eyebrow={zh ? "SMARTLINGO 社区活动" : "SMARTLINGO COMMUNITY EVENTS"} title={zh ? "找到下一次学习、开班与共同练习的机会。" : "Find your next opportunity to learn, lead a class, and practice together."} intro={zh ? "参加语言路径说明会、班级协调员工作坊、实时会话练习和班级社区交流。" : "Join language-path orientations, class-coordinator workshops, live conversation practice, and class Community sessions."} cards={document[lang]}/>;
}
