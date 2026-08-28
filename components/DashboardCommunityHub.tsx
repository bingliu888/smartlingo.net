import Link from "next/link";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import styles from "./DashboardCommunityHub.module.css";

export function DashboardCommunityHub({ lang }: { lang: InterfaceLanguage }) {
  const text = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const entries = [
    { icon: "◎", title: text("Nearby learning", "附近共学"), body: text("Meet opt-in adult learners by broad area, or start instantly with a clearly labeled AI classmate.", "按城市或地区匹配自愿加入的成年学习者，也可随时与明确标注的 AI 同学开始。"), href: `/${lang}/community#nearby`, action: text("Find a partner", "寻找学伴") },
    { icon: "◌", title: text("Community", "学习社区"), body: text("Join language discussions, study rooms, and friendly social practice without exposing exact location.", "加入语言讨论、学习房间和轻松社交练习，不公开精确位置。"), href: `/${lang}/community`, action: text("Open Community", "进入社区") },
  ];
  return <section className={styles.hub} aria-labelledby="dashboard-community-title">
    <header><p>COMMUNITY</p><h2 id="dashboard-community-title">{text("Learn with people and AI", "与真人和 AI 一起学")}</h2><span>{text("AI partners are always identified as AI. Real-member matching is adult-only, optional, and uses broad area—not GPS coordinates.", "AI 学伴始终明确标注为 AI；真人匹配仅限成年用户自愿开启，并只使用大致地区，不使用 GPS 坐标。")}</span></header>
    <div>{entries.map(entry => <article key={entry.href}><i aria-hidden="true">{entry.icon}</i><h3>{entry.title}</h3><p>{entry.body}</p><Link href={entry.href}>{entry.action} <span>→</span></Link></article>)}</div>
  </section>;
}
