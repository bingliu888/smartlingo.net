import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteHeader } from "../../../components/SiteHeader";
import { LearningPathPlanner } from "../../../components/LearningPathPlanner";

const copy = {
  en: {
    title: "Build usable vocabulary, reading, writing, listening, and dialogue.",
    intro: "Choose one of twelve target languages, set a goal and daily time, then start with fundamentals, a self-reported level, or a transparent adaptive placement.",
    start: "Choose a language",
    guide: "Ask Guru for guidance",
    catalog: "FOUNDATION PATH",
    course: "Speak from day one",
    courseBody: "A level-aware foundation path that joins practical vocabulary, comprehension, writing, pronunciation, and real conversation instead of treating them as separate products.",
    facts: [["Languages", "12"], ["Skills", "Vocabulary · Reading · Writing · Listening · Dialogue"], ["Format", "Self-paced or class-led"], ["Feedback", "Transparent, practice-only AI guidance"]],
    pathKicker: "LEARNING PATH",
    pathTitle: "Progress by mastery, not by an arbitrary deadline.",
    stages: [
      ["A1", "Build the foundation", "Core sounds, survival vocabulary, short messages, everyday questions, and low-pressure speaking."],
      ["A2", "Handle daily situations", "Travel, appointments, shopping, services, work routines, and longer listening or reading."],
      ["B1+", "Communicate independently", "Explain ideas, write practical documents, follow natural speech, and complete multi-step scenarios."],
      ["Focus", "Choose a real-life track", "Travel, workplace, hospitality, health support, customer service, study, or a teacher-created class focus."],
    ],
    practiceKicker: "DAILY PRACTICE HUB",
    practiceTitle: "Return to the exact skill that needs attention.",
    practice: [
      ["Vocabulary & review", "Flashcards, active recall, due words, examples, pronunciation, and a mistake loop."],
      ["Listening", "Short authentic scenarios, playback controls, notes, comprehension, and post-task transcripts."],
      ["Dialogue", "Guided prompts, role-play, live audio, pronunciation signals, and a clearly labeled provisional practice score."],
      ["Reading", "Level-matched passages, evidence questions, vocabulary help, and explanations after completion."],
      ["Writing", "Messages, emails, notes, descriptions, and revisions against a transparent practice rubric."],
      ["Social learning", "Class goals, partner practice, Community topics, direct messages, and group Live Chat."],
    ],
    classKicker: "TEACHER OR COORDINATOR",
    classTitle: "Turn an approved path into your own learning community.",
    classBody: "Any signed-in member can prepare a private class. Choose the language and level, set a schedule and price, invite learners, coordinate daily work, and moderate the class Community. Public discovery and real payments require production review.",
    classOptions: [
      ["Use an approved path", "Open a class from a versioned SmartLingo curriculum without changing the controlled learning content."],
      ["Coordinate the class", "Add announcements, study goals, optional assignments, office hours, group chat, and progress reminders."],
      ["Teach responsibly", "Provide human instruction and feedback while keeping private student work, payments, and AI output clearly separated."],
    ],
    safetyTitle: "AI guidance is practice support",
    safetyBody: "Guru feedback helps a learner notice patterns and decide what to practice next. It is not an official language score, immigration decision, professional license, or guarantee of study or employment results.",
    audioTitle: "Live audio requires sign-in",
    audioBody: "Public visitors may use text Ask Guru. Microphone and live-audio practice require a signed-in account, permission at the moment of use, visible usage status, and controls to stop the session.",
  },
  zh: {
    title: "建立真正可用的词汇、阅读、写作、听力与对话能力。",
    intro: "从十二种目标语言中选择一门，设定使用场景与每日时长，再从基础、自报水平或透明的自适应分级开始。",
    start: "选择学习语言",
    guide: "向智能导师咨询",
    catalog: "基础学习路径",
    course: "从第一天开始开口",
    courseBody: "根据水平调整的基础路径，把实用词汇、理解、写作、发音和真实对话连接起来，不把它们割裂成互不相关的产品。",
    facts: [["目标语言", "12 种"], ["核心技能", "词汇 · 阅读 · 写作 · 听力 · 对话"], ["学习方式", "自主学习或班级带领"], ["反馈性质", "透明标注、只用于练习的人工智能建议"]],
    pathKicker: "学习路径",
    pathTitle: "按掌握程度进步，不受任意期限限制。",
    stages: [
      ["A1", "建立基础", "核心发音、生存词汇、短消息、日常问题和低压力口语。"],
      ["A2", "应对日常场景", "旅行、预约、购物、服务、工作日常，以及更长的听力和阅读。"],
      ["B1+", "独立沟通", "解释观点、写实用文档、理解自然语速，并完成多步骤场景任务。"],
      ["专项", "选择真实应用方向", "旅行、职场、酒店餐饮、健康支持、客户服务、留学，或老师创建的班级重点。"],
    ],
    practiceKicker: "每日训练中心",
    practiceTitle: "准确回到真正需要加强的技能。",
    practice: [
      ["词汇与复习", "词汇卡、主动回忆、到期词汇、例句、发音和错题循环。"],
      ["听力", "真实短场景、播放控制、笔记、理解题，以及完成后的文字稿。"],
      ["对话", "引导提示、角色扮演、实时语音、发音信号和明确标注的暂定练习分。"],
      ["阅读", "符合水平的文章、证据题、词汇帮助和完成后的讲解。"],
      ["写作", "消息、邮件、记录、说明，以及依据透明练习量表进行修改。"],
      ["共同学习", "班级目标、伙伴练习、社区主题、私信和群组实时聊天。"],
    ],
    classKicker: "老师或学习协调员",
    classTitle: "把经批准的学习路径变成自己的学习社区。",
    classBody: "任何已登录会员都可以准备私有班级：选择语言与等级、设置日程和价格、邀请学员、协调每日任务并治理班级社区。进入公开目录和启用真实付款前必须完成生产审核。",
    classOptions: [
      ["使用经批准的路径", "从带版本的 SmartLingo 课程建立班级，不修改受控的核心学习内容。"],
      ["协调班级", "加入公告、学习目标、可选作业、答疑时间、群聊和进度提醒。"],
      ["负责任地教学", "提供真人教学与反馈，并清楚隔离学员隐私、付款数据和人工智能输出。"],
    ],
    safetyTitle: "人工智能建议只用于辅助练习",
    safetyBody: "导师反馈帮助学习者发现规律并决定下一步训练重点。它不是官方语言成绩、移民决定、专业执照，也不保证留学或就业结果。",
    audioTitle: "实时语音需要登录",
    audioBody: "访客可以使用文字智能导师。麦克风和实时语音练习需要登录，在使用当时取得权限，并持续显示使用状态与停止控制。",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "zh" ? "语言学习路径" : "Language learning paths" };
}

export default async function ProgramsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") notFound();
  const t = copy[lang];
  return <main className="ai-cert-public-page lingo-public-page" data-layout-page="programs">
    <div className="ai-public-hero-shell" data-layout-fill="programs-hero-shell"><SiteHeader lang={lang}/><section className="ai-public-hero"><p className="section-kicker">SMARTLINGO · {lang === "zh" ? "选择课程" : "CHOOSE COURSE"}</p><h1 data-layout-text-fit="programs-title">{t.title}</h1><p data-readable-copy="programs-hero-copy">{t.intro}</p><div className="ai-cert-actions" data-layout-track="programs-actions"><Link className="primary-button" href="#language-catalog">{t.start} →</Link><Link className="secondary-button" href={`/${lang}/assistant`}>{t.guide}</Link></div></section></div>
    <LearningPathPlanner lang={lang} catalogOnly/>
    <SiteFooter lang={lang}/>
  </main>;
}
