import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params; return { title: lang === "zh" ? "SmartCard 学习教程" : "SmartCard learning tutorial" };
}

export default async function SmartCardTutorial({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params; if (lang !== "en" && lang !== "zh" && lang !== "es" && lang !== "ja" && lang !== "ko" && lang !== "fr" && lang !== "de" && lang !== "ru" && lang !== "it" && lang !== "pt" && lang !== "ar" && lang !== "hi") notFound(); const zh = lang === "zh";
  const steps = zh ? [
    ["看词猜义", "每次只显示一张卡和一个目标词。点击可查看当前词的含义；下方选项只显示含义，不泄露其他目标词。"],
    ["间隔后再想", "离开几分钟或等到第二天再挑战。真正的记忆来自隔开后的提取，而不是短时间连续点击。"],
    ["自动答题与跟读", "答对立即加 10 分并进入跟读；答错扣 5 分，最多再试三次。发音通过再加 5 分，然后自动进入下一张。"],
    ["分享给朋友", "复制公开链接。朋友无需登录即可学习；自己挑战自己的卡不会获得可抵费积分。"],
    ["安全领取", "每轮从 100 个待领取课程积分开始。完成整轮并登录后才安全入账；不会自动购买课程套餐。"],
    ["兑换三个月套餐", "100 点抵 1 美元。余额达到所选等级三个月套餐的价格后，可一次兑换该语言课程三个月，不自动续订。"],
  ] : [
    ["See one word", "Each turn shows one card and one target word. Tap for its meaning; answer choices show meanings without exposing other target words."],
    ["Recall after a gap", "Leave for a few minutes or return tomorrow. Durable memory comes from retrieval after spacing, not rapid repeated clicks."],
    ["Answer and speak", "A correct choice adds 10 and moves straight to speaking. A wrong choice subtracts 5 with up to three tries. A pronunciation pass adds 5, then the next card starts automatically."],
    ["Share with a friend", "Copy the public link. Friends can learn without signing in; challenging your own deck never earns redeemable credit."],
    ["Claim safely", "Each round starts with 100 provisional course points. Complete the deck and sign in before they post to the course-credit ledger; no course package is purchased automatically."],
    ["Redeem a three-month package", "100 points offset $1. When the balance reaches the selected level's three-month price, redeem three months of that language course with no auto-renewal."],
  ];
  return <main className="smartcard-tutorial"><SiteHeader lang={lang}/><article><header><p>COURSE RESOURCE · SMARTCARD</p><h1>{zh ? "把词卡变成真正会用的语言。" : "Turn flashcards into language you can use."}</h1><p>{zh ? "这份教程同时作为课程学习室的 SmartCard 资源。六步完成学习、挑战、分享、积分领取和固定期限套餐兑换。" : "This tutorial is also the SmartCard resource in every course learning room. Six steps cover learning, challenge, sharing, claiming, and fixed-term package redemption."}</p></header><ol>{steps.map(([title, body], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{title}</h2><p>{body}</p></div></li>)}</ol><aside><h2>{zh ? "教学原则" : "Learning principle"}</h2><p>{zh ? "课程把意义输入、意义输出、语言聚焦和流利度训练保持平衡。SmartCard 负责记忆与提取，但必须回到听、说、读、写和真实社交任务。" : "Courses balance meaning-focused input, meaning-focused output, language-focused learning, and fluency. SmartCards support memory and retrieval, but always return to listening, speaking, reading, writing, and real social tasks."}</p></aside><div><Link href={`/${lang}/smartcards`}>{zh ? "开始公开挑战" : "Start a public challenge"} →</Link><Link href={`/${lang}/programs`}>{zh ? "选择完整课程" : "Choose a full course"}</Link></div></article><SiteFooter lang={lang}/><style>{`.smartcard-tutorial{background:#f7f3ea;color:var(--ink)}.smartcard-tutorial>article{width:min(1020px,calc(100% - 36px));margin:auto;padding:100px 0}.smartcard-tutorial header>p:first-child{color:#087d62;font-size:12px;font-weight:950;letter-spacing:.1em}.smartcard-tutorial h1{margin:12px 0 20px;font:600 clamp(45px,7vw,82px)/1 "Iowan Old Style","Noto Serif SC",serif}.smartcard-tutorial header>p:last-child{max-width:72ch;color:#596c65;font-size:18px;line-height:1.7}.smartcard-tutorial ol{margin:55px 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;list-style:none}.smartcard-tutorial li{padding:24px;display:grid;grid-template-columns:auto 1fr;gap:16px;border:1px solid #bfd3ca;border-radius:18px;background:#fff}.smartcard-tutorial li>span{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#123f35;color:#fff;font-weight:900}.smartcard-tutorial h2{margin:4px 0 9px}.smartcard-tutorial li p,.smartcard-tutorial aside p{color:#596c65;line-height:1.65}.smartcard-tutorial aside{padding:34px;border-radius:20px;background:#e4f7ef}.smartcard-tutorial article>div{margin-top:25px;display:flex;gap:10px;flex-wrap:wrap}.smartcard-tutorial article>div a{min-height:50px;padding:12px 19px;display:flex;align-items:center;border:2px solid #087d62;border-radius:999px;color:#087d62;font-weight:850;text-decoration:none}.smartcard-tutorial article>div a:first-child{background:#087d62;color:#fff}@media(max-width:650px){.smartcard-tutorial ol{grid-template-columns:1fr}.smartcard-tutorial>article{padding-top:70px}}`}</style></main>;
}
