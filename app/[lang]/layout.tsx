import type { Metadata } from "next";
import { LanguageSync, type SiteLanguage } from "../../components/LanguageMemory";
import { PersistentCallProvider } from "../../components/PersistentCallProvider";
import { safeInterfaceLanguage } from "../../lib/interface-locale";
import { LocaleRuntime } from "../../components/LocaleRuntime";
import { LocalizedClerkProvider } from "../../components/LocalizedClerkProvider";
import { NotificationBar } from "../../components/NotificationBar";
import { FloatingAssistant } from "../../components/FloatingAssistant";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const zh = lang === "zh" || lang === "zh-tw";
  return {
    title: {
      default: zh ? "SmartLingo — 从第一天开口，与课程一起进步" : "SmartLingo — Speak from day one. Learn together.",
      template: "%s | SmartLingo",
    },
    description: zh
      ? "人工智能原生语言学习：十二种语言、三级课程、免费与 Max、五项技能与课程网络研讨会。"
      : "AI-native language learning across twelve languages with three course levels, Free and Max plans, five-skill practice, Webinar teaching rooms, and group-audio practice rooms.",
  };
}

export default async function LanguageLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  const safeLanguage: SiteLanguage = safeInterfaceLanguage(lang);
  return <LocalizedClerkProvider language={safeLanguage}><NotificationBar/><PersistentCallProvider lang={safeLanguage === "zh" || safeLanguage === "zh-tw" ? "zh" : "en"}><LocaleRuntime locale={safeLanguage}/><LanguageSync lang={safeLanguage}/>{children}</PersistentCallProvider><FloatingAssistant/></LocalizedClerkProvider>;
}
