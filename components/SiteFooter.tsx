import Link from "next/link";
import { LanguageLink } from "./LanguageMemory";

export function SiteFooter({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  return (
    <footer className="global-site-footer ai-cert-footer">
      <div className="footer-identity">
        <strong>Smart<span>Lingo</span></strong>
        <span>{zh ? "从第一天开口 · 人工智能导师 · 会员开班 · 一起学习" : "Speak from day one · AI Guru · Member-led classes · Learn together"}</span>
        <small>© 2026 SmartLingo.net</small>
      </div>
      <nav aria-label={zh ? "页脚导航" : "Footer navigation"}>
        <Link href={`/${lang}/programs`}>{zh ? "选择课程" : "Choose course"}</Link>
        <Link href={`/${lang}/assistant`}>{zh ? "咨询专家" : "Ask Guru"}</Link>
        <Link href={`/${lang}/pricing`}>{zh ? "方案" : "Plans"}</Link>
        <Link href={`/${lang}/project`}>{zh ? "项目" : "Project"}</Link>
        <Link href={`/${lang}/about`}>{zh ? "关于我们" : "About"}</Link>
        <Link href={`/${lang}/privacy`}>{zh ? "隐私政策" : "Privacy"}</Link>
        <Link href={`/${lang}/terms`}>{zh ? "使用条款" : "Terms"}</Link>
        <LanguageLink lang={lang} compact/>
      </nav>
    </footer>
  );
}
