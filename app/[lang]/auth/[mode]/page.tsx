import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClerkAuthForm } from "../../../../components/ClerkAuthForm";
import { LanguageLink } from "../../../../components/LanguageMemory";

const pageCopy = {
  en: { title: "Sign in or join", description: "Enter your email for a one-time code. Your first verified sign-in creates a SmartLingo account automatically.", quote: "Speak from day one. Learn with people.", back: "Back to home" },
  zh: { title: "登录或加入", description: "输入邮箱获取一次性验证码。首次验证成功后，系统将自动创建 SmartLingo 账号。", quote: "从第一天开口，和真实的人一起学。", back: "返回首页" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> { const { lang } = await params; return { title: pageCopy[lang === "zh" ? "zh" : "en"].title }; }
export default async function AuthPage({ params, searchParams }: { params: Promise<{ lang: string; mode: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { lang, mode } = await params; if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound(); if (mode !== "login") redirect(`/${lang}/auth/login`); const t = pageCopy[lang];
  const query = await searchParams; const returnTo = query.returnTo && /^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(query.returnTo) ? query.returnTo : `/${lang}/dashboard`;
  return <main className="auth-page" data-layout-page="auth"><aside className="auth-art gc-auth-art smartlingo-auth-art" data-layout-track="auth-art"><Link className="brand inverse smartlingo-brand" href={`/${lang}`}><span className="lingo-brand-mark" aria-hidden="true">S</span><span>Smart<em>Lingo</em></span></Link><div className="gc-auth-mark" aria-hidden="true"><span>语</span><i/><i/><i/></div><blockquote>{t.quote}</blockquote><p>{lang === "zh" ? "词汇阅读写作听力对话 · 会员开班 · 学习社区" : "FIVE SKILLS · MEMBER COURSES · COMMUNITY"}</p></aside><section className="auth-panel" data-layout-track="auth-panel"><div className="auth-top" data-layout-fill="auth-top"><Link href={`/${lang}`}>← {t.back}</Link><LanguageLink lang={lang}/></div><div className="auth-box" data-readable-copy="auth-copy"><p className="eyebrow">{lang === "zh" ? "安全账户访问" : "SECURE ACCOUNT ACCESS"}</p><h1 data-layout-text-fit="auth-title">{t.title}</h1><p>{lang === "zh" ? "使用邮箱验证码或密码继续。首次验证邮箱会自动创建账户。" : "Continue with an email code or password. A new verified email creates your account automatically."}</p><ClerkAuthForm lang={lang} returnTo={returnTo}/></div></section></main>;
}
