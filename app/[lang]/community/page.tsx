import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CommunityClient } from "../../../components/CommunityClient";
import { CommunityMeetings } from "../../../components/CommunityMeetings";
import { NearbyLearning } from "../../../components/NearbyLearning";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { interfaceText, isInterfaceLanguage } from "../../../lib/interface-locale";
import { requestUser } from "../../../lib/request-user";
import "./community-profile.css";
import "./live-profile.css";
import "./member-drawer.css";
import "./responsive.css";
import "./active-header.css";
import "./message-link.css";
import "./meetings.css";
import "./community-hub.css";

export const dynamic = "force-dynamic";

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  const user = await requestUser();
  if (!user) redirect(`/${lang}/auth/login?returnTo=${encodeURIComponent(`/${lang}/community`)}`);
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);

  return <main className="community-page" data-layout-page="community" data-layout-ready="true">
    <SiteHeader lang={lang}/>
    <section className="community-hero" data-layout-fill="community-hero">
      <div><p className="section-kicker">COMMUNITY · LEARN TOGETHER</p><h1>{text("Practice with people, AI classmates, and your own learning school.", "和真人、AI 同学以及自己的学习学院一起练。")}</h1><p>{text("Find a partner, complete a shared mission, join a live study conversation, or learn through a college language department. Social activity supports practice; it never changes verified course scores or payment records.", "找伙伴、完成共同任务、加入实时学习会话，或通过学院语言部门学习。社交活动用于陪练，不会改写已验证课程成绩或付款记录。")}</p></div>
      <aside><strong>{text("Designed for trust", "以信任为前提")}</strong><span>{text("Nearby is opt-in, adult-only, and coarse-region only. AI partners are always labeled AI. Every real-member card includes block and report controls.", "Nearby 仅限成年会员主动开启，只显示大区域；AI 伙伴始终标注为 AI；每张真人卡片都提供屏蔽和举报。")}</span></aside>
    </section>
    <nav className="community-entry-grid" aria-label={text("Community areas", "社区区域")}>
      <a href="#nearby"><small>01 · NEARBY</small><strong>{text("Learn together", "一起边玩边学")}</strong><span>{text("AI classmates plus optional real-member matching", "AI 同学与可选真人匹配")}</span></a>
      <a href="#discussions"><small>02 · DISCUSS</small><strong>{text("Learning discussions", "学习讨论")}</strong><span>{text("Questions, reflections, and useful practice notes", "问题、复盘与实用练习心得")}</span></a>
      <Link href={`/${lang}/colleges`}><small>03 · COLLEGES</small><strong>{text("Learning schools", "学习学院")}</strong><span>{text("College → language department → platform courses", "学院 → 语言部门 → 平台课程")}</span></Link>
      <Link href={`/${lang}/play/rankings`}><small>04 · RANKINGS</small><strong>{text("Fair rankings", "公平排行榜")}</strong><span>{text("Compare verified learning days by category and language", "按类别和语言比较已验证学习日")}</span></Link>
    </nav>
    <NearbyLearning lang={lang}/>
    <CommunityMeetings lang={lang}/>
    <section className="community-discussions-heading" id="discussions"><div><p className="section-kicker">DISCUSS · REFLECT · HELP</p><h2>{text("The learning commons", "学习共享区")}</h2></div><Link href={`/${lang}/messages`}>{text("Open messages", "打开消息")} →</Link></section>
    <CommunityClient lang={lang}/>
    <SiteFooter lang={lang}/>
  </main>;
}
