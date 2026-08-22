import type { Metadata } from "next";
import { LanguageSync, type SiteLanguage } from "../../components/LanguageMemory";
import { PersistentCallProvider } from "../../components/PersistentCallProvider";
import { safeInterfaceLanguage } from "../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const zh = lang === "zh";
  return {
    title: {
      default: zh ? "SmartLingo — 从第一天开口，与课程一起进步" : "SmartLingo — Speak from day one. Learn together.",
      template: "%s | SmartLingo",
    },
    description: zh
      ? "人工智能原生语言学习：十二种语言、三级固定月费课程、首月免费、五项技能与课程网络研讨会。"
      : "AI-native language learning across twelve languages with three fixed monthly course levels, a free first month, five-skill practice, Webinar teaching rooms, and group-audio practice rooms.",
  };
}

export default async function LanguageLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  const safeLanguage: SiteLanguage = safeInterfaceLanguage(lang);
  return <PersistentCallProvider lang={safeLanguage === "zh" ? "zh" : "en"}><LanguageSync lang={safeLanguage}/>{children}</PersistentCallProvider>;
}
