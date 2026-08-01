import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";

const copy = {
  en: {
    eyebrow: "ABOUT SMARTLINGO",
    title: "Language learning that connects daily practice, teachers, and community.",
    intro: "SmartLingo is an independent AI-native language-learning platform built around vocabulary, reading, writing, listening, dialogue, member-led classes, social learning, and transparent commerce.",
    sections: [
      ["Our starting point", "The prior SmartLingo public experience centered on speaking from day one with an AI tutor, pronunciation feedback, structured A1-to-A2 learning, daily radio, reading, vocabulary, seven languages, and social progress."],
      ["Four skills, one daily loop", "Listening, speaking, reading, and writing connect to short lessons, spaced review, vocabulary cards, mistake practice, and progress that a learner can understand."],
      ["Every member may lead", "A signed-in member may prepare a private class as teacher or coordinator, choose an approved language path, invite students, set a schedule, and build a focused class Community."],
      ["People and AI together", "Public text Ask Guru offers a starting point. Signed-in members may use microphone and live-audio practice while classmates connect through Community, messages, and direct or group Live Chat."],
      ["Transparent class payments", "The planned Stripe Connect flow applies a one-time 15% discount to each learner’s first successful payment in a class, then splits the discounted pre-tax amount 70% to the class owner and 30% to the platform."],
      ["Referral boundary", "Introducer points apply only to successful platform subscription charges under published rules. Member-created class purchases and owner payouts never generate introducer points, and the program remains single-level."],
    ],
  },
  zh: {
    eyebrow: "关于 SMARTLINGO",
    title: "把每日语言训练、老师和学习社区真正连接起来。",
    intro: "SmartLingo 是独立的人工智能原生语言学习平台，围绕词汇、阅读、写作、听力、对话五项技能、会员自主开班、社交学习与透明商务规则建设。",
    sections: [
      ["我们的起点", "原 SmartLingo 公开体验以从第一天开口为中心，提供人工智能导师、发音反馈、A1 至 A2 结构化学习、每日广播、阅读、词汇、七种语言与社交进度。"],
      ["四项能力，一个每日闭环", "听力、口语、阅读和写作与短课、间隔复习、词汇卡、错题训练及清楚易懂的学习进度连接起来。"],
      ["每位会员都可以带班", "登录会员可作为老师或协调员准备私有班级，选择经批准的语言路径、邀请学员、设置日程，并建立专属班级社区。"],
      ["真人与人工智能共同学习", "公开文字智能导师提供起点；登录会员可使用麦克风和实时语音，并通过社区、消息、私聊或群组实时聊天与同学连接。"],
      ["班级付款透明", "计划采用 Stripe Connect：每位学员在每个班级的首次成功付款享一次八五折，再以折后税前金额为基础向班主分配七成、平台分配三成。"],
      ["推荐奖励边界", "介绍人积分只适用于规则公布后成功收取的平台订阅费。会员创建班级的购买与班主收款永不产生介绍人积分，推荐关系只保留一层。"],
    ],
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "About" : "关于我们" };
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const t = copy[lang];
  return (
    <main className="ai-cert-legal-page">
      <SiteHeader lang={lang}/>
      <article className="ai-cert-legal-main">
        <p className="section-kicker">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="ai-legal-intro">{t.intro}</p>
        <div className="ai-legal-sections">{t.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>
      </article>
      <SiteFooter lang={lang}/>
    </main>
  );
}
