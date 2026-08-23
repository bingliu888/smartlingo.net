import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClerkSessionBridge } from "../../../../components/ClerkSessionBridge";
import { LanguageLink } from "../../../../components/LanguageMemory";
import { SmartLingoWordmark } from "../../../../components/SmartLingoWordmark";

const safeReturnTo = (value: string | undefined, lang: "en" | "zh") =>
  value && /^\/(?!\/)[A-Za-z0-9/_?&=.%#-]*$/.test(value)
    ? value
    : `/${lang}/dashboard`;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "正在完成登录" : "Completing sign-in" };
}

export default async function AuthCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound();
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo, lang === "zh" ? "zh" : "en");

  return <main className="auth-page">
    <aside className="auth-art gc-auth-art smartlingo-auth-art">
      <Link className="brand inverse smartlingo-brand" href={`/${lang}`}><SmartLingoWordmark/></Link>
      <blockquote>{lang === "zh" ? "安全登录后，继续您的语言学习、课程与社区。" : "Continue your language learning, courses, and Community after secure sign-in."}</blockquote>
    </aside>
    <section className="auth-panel">
      <div className="auth-top">
        <Link href={`/${lang}`}>← {lang === "zh" ? "返回首页" : "Back to home"}</Link>
        <LanguageLink lang={lang as any}/>
      </div>
      <ClerkSessionBridge lang={lang as any} returnTo={returnTo}/>
    </section>
  </main>;
}
