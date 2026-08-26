import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClerkAuthForm } from "../../../../components/ClerkAuthForm";
import { LanguageLink } from "../../../../components/LanguageMemory";
import { interfaceText, isInterfaceLanguage, safeInterfaceLanguage } from "../../../../lib/interface-locale";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: rawLang } = await params;
  const lang = safeInterfaceLanguage(rawLang);
  return { title: interfaceText(lang, "Sign in or join", "登录或加入") };
}

export default async function AuthPage({ params, searchParams }: {
  params: Promise<{ lang: string; mode: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { lang, mode } = await params;
  if (!isInterfaceLanguage(lang)) notFound();
  if (mode !== "login") redirect(`/${lang}/auth/login`);
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const query = await searchParams;
  const returnTo = query.returnTo && /^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(query.returnTo)
    ? query.returnTo
    : `/${lang}/dashboard`;

  return <main className="auth-page" data-layout-page="auth" dir={lang === "ar" ? "rtl" : "ltr"}>
    <aside className="auth-art gc-auth-art smartlingo-auth-art" data-layout-track="auth-art">
      <Link className="brand inverse smartlingo-brand" href={`/${lang}`}>
        <span className="lingo-brand-mark" aria-hidden="true">S</span>
        <span>Smart<em>Lingo</em></span>
      </Link>
      <div className="gc-auth-mark" aria-hidden="true"><span>语</span><i/><i/><i/></div>
      <blockquote>{t("Speak from day one. Learn with people.", "从第一天开口，和真实的人一起学。")}</blockquote>
      <p>{t("FIVE SKILLS · MEMBER COURSES · COMMUNITY", "词汇阅读写作听力对话 · 会员开班 · 学习社区")}</p>
    </aside>
    <section className="auth-panel" data-layout-track="auth-panel">
      <div className="auth-top" data-layout-fill="auth-top">
        <Link href={`/${lang}`}>← {t("Back to home", "返回首页")}</Link>
        <LanguageLink lang={lang}/>
      </div>
      <div className="auth-box" data-readable-copy="auth-copy">
        <p className="eyebrow">{t("SECURE ACCOUNT ACCESS", "安全账户访问")}</p>
        <h1 data-layout-text-fit="auth-title">{t("Sign in or join", "登录或加入")}</h1>
        <p>{t(
          "Use an email code, or choose a password. In password mode, a new email creates an account immediately without another email check.",
          "可使用邮箱验证码，或切换为密码。密码模式下，新邮箱会立即创建账户，无需再次验证邮箱。",
        )}</p>
        <ClerkAuthForm lang={lang} returnTo={returnTo}/>
      </div>
    </section>
  </main>;
}
