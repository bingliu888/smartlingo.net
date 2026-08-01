import type { Metadata } from "next";
import { LanguageSync, type SiteLanguage } from "../../components/LanguageMemory";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const zh = lang === "zh";
  return {
    title: {
      default: zh ? "SmartLingo — 从第一天开口，与班级一起进步" : "SmartLingo — Speak from day one. Learn together.",
      template: "%s | SmartLingo",
    },
    description: zh
      ? "人工智能原生语言学习：九种语言、听说读写、实时语音导师、会员自主开班与学习社区。"
      : "AI-native language learning across nine languages with four-skill practice, live voice, member-led classes, and learning communities.",
  };
}

export default async function LanguageLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  const safeLanguage: SiteLanguage = lang === "zh" ? "zh" : "en";
  return <><LanguageSync lang={safeLanguage}/>{children}</>;
}
