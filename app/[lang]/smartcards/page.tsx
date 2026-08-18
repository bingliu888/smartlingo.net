import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
const languages = [
    ["en", "English", "英语"], ["zh", "Chinese", "中文"], ["es", "Spanish", "西班牙语"], ["ja", "Japanese", "日语"],
    ["ko", "Korean", "韩语"], ["fr", "French", "法语"], ["de", "German", "德语"], ["ru", "Russian", "俄语"],
    ["it", "Italian", "意大利语"], ["pt", "Portuguese", "葡萄牙语"], ["ar", "Arabic", "阿拉伯语"], ["hi", "Hindi", "印地语"],
] as const;
export async function generateMetadata({ params }: {
    params: Promise<{
        lang: string;
    }>;
}): Promise<Metadata> {
    const { lang } = await params;
    return { title: lang === "zh" ? "免费 SmartCard 挑战" : "Free SmartCard challenges" };
}
export default async function SmartCardsPage({ params, searchParams }: {
    params: Promise<{
        lang: string;
    }>;
    searchParams: Promise<{
        mode?: string;
    }>;
}) {
    const { lang } = await params;
    if (lang !== "en" && lang !== "zh")
        notFound();
    const zh = lang === "zh";
    const challenge = (await searchParams).mode === "challenge";
    return <main className="smartcard-directory"><SiteHeader lang={lang}/><section className="smartcard-directory-hero"><p>{challenge ? "DAILY SMART CARD CHALLENGE" : "SMART CARD PRACTICE"}</p><h1>{challenge ? (zh ? "选择今天要挑战的语言。" : "Choose today's challenge language.") : (zh ? "不登录，也能先学会第一组实用表达。" : "Learn your first useful phrases without signing in.")}</h1><p>{zh ? "每张卡只显示一个目标词：选择含义、听 AI 发音、再开口跟读。完成整轮后登录，即可把成绩保存为可抵课程费的课程积分。" : "Each card shows one target word: choose its meaning, listen to AI, and repeat aloud. Finish the round and sign in to save the result as course credit."}</p><div><strong>100</strong><span>{zh ? "分起步" : "starting points"}</span><strong>+10</strong><span>{zh ? "答对" : "correct"}</span><strong>+5</strong><span>{zh ? "发音通过" : "pronunciation"}</span></div></section><section className="smartcard-language-grid">{languages.map(([code, en, cn]) => <Link href={`/${lang}/smartcards/starter-${code}${challenge ? "?mode=challenge" : ""}`} key={code}><span>{code.toUpperCase()}</span><h2>{zh ? cn : en}</h2><p>{zh ? "12 张审核入门词卡 · 无需登录" : "12 reviewed starter cards · no sign-in"}</p><b>{challenge ? (zh ? "进入今日挑战" : "Enter today's challenge") : (zh ? "开始练习" : "Start practice")} →</b></Link>)}</section><section className="smartcard-directory-policy"><h2>{zh ? "同一套课程积分，服务器安全计分。" : "One course-credit balance, scored securely."}</h2><p>{zh ? "答对 +10，答错 -5，发音通过 +5。访客以 100 个待领取课程积分开始；完成整轮并登录后才入账。练习卡组版本仅首次领取；每日挑战每个账户每天每个卡组仅领取一次；自制卡组不奖励积分。100 点抵 1 美元，最多抵当月全额课程费。" : "Correct +10, wrong −5, pronunciation pass +5. Guests start with 100 provisional course points; credit posts only after completing the round and signing in. Practice rewards once per deck version; daily challenges once per account, deck, and day; self-authored decks earn none. 100 points offset $1, up to the full monthly course fee."}</p></section><SiteFooter lang={lang}/><style>{`.smartcard-directory{min-height:100vh;background:#f7f3ea;color:var(--ink)}.smartcard-directory-hero,.smartcard-language-grid,.smartcard-directory-policy{width:min(1280px,calc(100% - 40px));margin-inline:auto}.smartcard-directory-hero{padding:110px 0 70px}.smartcard-directory-hero>p:first-child{color:#087d62;font-size:12px;font-weight:950;letter-spacing:.11em}.smartcard-directory-hero h1{max-width:1100px;margin:12px 0 22px;font:600 clamp(46px,7vw,90px)/.98 "Iowan Old Style","Noto Serif SC",serif}.smartcard-directory-hero>p:nth-of-type(2){max-width:78ch;color:#586b64;font-size:18px;line-height:1.7}.smartcard-directory-hero>div{margin-top:30px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.smartcard-directory-hero strong{margin-left:22px;color:#087d62;font-size:33px}.smartcard-directory-hero strong:first-child{margin-left:0}.smartcard-language-grid{padding-bottom:80px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.smartcard-language-grid a{padding:27px;border:1px solid #b9d2c8;border-radius:19px;background:#fff;color:inherit;text-decoration:none;transition:transform .2s,box-shadow .2s}.smartcard-language-grid a:hover{transform:translateY(-3px);box-shadow:0 14px 35px rgba(20,55,45,.12)}.smartcard-language-grid span{color:#087d62;font-size:11px;font-weight:950;letter-spacing:.1em}.smartcard-language-grid h2{margin:15px 0 8px;font-size:29px}.smartcard-language-grid p{color:#60716b}.smartcard-language-grid b{display:block;margin-top:24px;color:#087d62}.smartcard-directory-policy{margin-bottom:100px;padding:clamp(24px,5vw,55px);border-radius:25px;background:#123f35;color:#fff}.smartcard-directory-policy h2{font-size:clamp(30px,4vw,50px)}.smartcard-directory-policy p{max-width:76ch;color:#c7ded6;line-height:1.7}@media(max-width:850px){.smartcard-language-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.smartcard-directory-hero,.smartcard-language-grid,.smartcard-directory-policy{width:min(100% - 28px,1280px)}.smartcard-language-grid{grid-template-columns:1fr}.smartcard-directory-hero{padding-top:70px}}`}</style></main>;
}
