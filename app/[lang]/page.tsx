import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PlayDailySprintPicker } from "../../components/PlayDailySprintPicker";
import { PlatformPlans } from "../../components/PlatformPlans";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import { homeInterfaceTranslations } from "../../lib/home-interface-translations.generated";
import { interfaceCopyFor, safeInterfaceLanguage, translateHomeCopy } from "../../lib/interface-locale";
import { smartLingoTutorialCopyFor } from "../../lib/smartlingo-tutorial";

const copy = {
  en: {
    metaTitle: "SmartLingo — Speak from day one",
    eyebrow: "AI-NATIVE LANGUAGE LEARNING",
    title: "Speak a new language from day one.",
    intro: "Practice real situations with an AI Guru, receive clear corrections, and keep learning with a teacher-led course and its own social community.",
    start: "Start learning free",
    classes: "Explore courses",
    voice: "Try Ask Guru",
    trust: ["12 target languages", "Five-skill practice", "Course communities"],
    coachLabel: "TODAY · DIALOGUE PRACTICE",
    coachTitle: "Order lunch with confidence",
    coachPrompt: "Tell the server what you would like, ask about an ingredient, then confirm the order.",
    coachStatus: "AI Guru is ready to listen",
    skills: [["Vocabulary", "82"], ["Reading", "91"], ["Writing", "76"], ["Listening", "84"], ["Dialogue", "72"]],
    languagesKicker: "CHOOSE YOUR PATH",
    languagesTitle: "Twelve languages, one connected learning loop.",
    languagesBody: "Each community supports learners starting a new language and members continuing to develop a language they already speak. Every path combines vocabulary, reading, writing, listening, and AI-supported dialogue.",
    loopKicker: "NOT JUST WORD LISTS",
    loopTitle: "Build vocabulary, read, write, listen, and hold real dialogue.",
    loopBody: "SmartLingo uses short daily tasks, spaced review, transparent skill scores, and human-visible progress. AI feedback supports practice; it never pretends to be a human teacher or an official exam result.",
    loop: [
      ["01", "Learn", "Follow an adaptive path with compact lessons, original examples, vocabulary cards, and a daily goal."],
      ["02", "Practice", "Complete focused vocabulary, reading, writing, listening, and dialogue tasks based on your current level."],
      ["03", "Talk", "Use text or signed-in live audio with the AI Guru in course-defined real-life scenarios."],
      ["04", "Review", "Return to mistakes and due vocabulary; keep a streak without losing access when life interrupts."],
    ],
    socialKicker: "LEARN WITH PEOPLE",
    socialTitle: "A language course should feel alive between lessons.",
    social: [
      ["Course Community", "Topics, questions, study notes, announcements, moderation, and classmates who share the same learning context."],
      ["Messages & Live Chat", "Direct and group conversations with replies, attachments, notifications, presence, and safe reporting tools."],
      ["AI Guru & live audio", "Public text guidance and signed-in microphone or live-audio practice with course context and usage controls."],
      ["Progress that helps", "Daily goals, skill mastery, streaks, course milestones, and privacy-safe aggregate teacher views."],
    ],
    readyTitle: "Choose a language and say the first sentence today.",
    readyBody: "Learn every Beginner course free with ads. Enter Intermediate or Advanced to start one 7-day Max trial, then activate Max to continue.",
    readyAction: "Create free account",
  },
  zh: {
    metaTitle: "SmartLingo — 从第一天开口",
    eyebrow: "人工智能原生语言学习",
    title: "从第一天开始，开口说一门新语言。",
    intro: "和人工智能导师练习真实场景，当场获得清楚纠正；也可以加入老师带领的课程，在自己的学习社区里一起进步。",
    start: "免费开始学习",
    classes: "浏览语言班",
    voice: "试用智能导师",
    trust: ["十二种目标语言", "五项技能训练", "课程学习社区"],
    coachLabel: "今日任务 · 对话练习",
    coachTitle: "自信地完成一次点餐",
    coachPrompt: "告诉服务员您想点什么，询问一种配料，然后确认订单。",
    coachStatus: "人工智能导师已准备聆听",
    skills: [["词汇", "82"], ["阅读", "91"], ["写作", "76"], ["听力", "84"], ["对话", "72"]],
    languagesKicker: "选择学习路径",
    languagesTitle: "十二种语言，同一套完整学习闭环。",
    languagesBody: "每个社区既欢迎开始学习新语言的人，也欢迎继续提高自己已会语言的会员。每条路径都把词汇、阅读、写作、听力和人工智能对话连接起来。",
    loopKicker: "不只是背单词",
    loopTitle: "练词汇、做阅读、写作、听力和真实对话，再回到需要加强的地方。",
    loopBody: "SmartLingo 使用每日短任务、间隔复习、透明技能分和可见进度。人工智能反馈用于辅助练习，不冒充真人教师，也不把练习分数写成官方考试结果。",
    loop: [
      ["01", "学习", "沿着自适应路径完成短课、原创例句、词汇卡和每日目标。"],
      ["02", "训练", "根据当前水平完成针对性的词汇、阅读、写作、听力和对话任务。"],
      ["03", "对话", "用文字或登录后的实时语音，与人工智能导师练习课程定义的真实场景。"],
      ["04", "复习", "回到错题和到期词汇；中断学习不会失去课程使用权，可重新继续。"],
    ],
    socialKicker: "和真实的人一起学习",
    socialTitle: "一门语言班，在下课后也应该保持活力。",
    social: [
      ["课程社区", "主题、提问、学习笔记、公告、治理工具，以及拥有相同学习背景的同班同学。"],
      ["消息与实时聊天", "私聊和群聊支持回复、附件、通知、在线状态与安全举报。"],
      ["人工智能导师与实时语音", "公开文字帮助；登录后使用麦克风或实时语音，并按课程上下文练习。"],
      ["真正有帮助的进度", "每日目标、技能掌握、连续学习、课程里程碑，以及保护隐私的老师汇总视图。"],
    ],
    readyTitle: "今天就选一种语言，说出第一句话。",
    readyBody: "全部初级课程可带广告免费学习；首次进入中级或高级会开始一次 7 天 Max 试用，之后开通 Max 才能继续。",
    readyAction: "免费创建账户",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = safeInterfaceLanguage(lang);
  const localized = locale === "zh" ? copy.zh : translateHomeCopy(copy.en, locale, homeInterfaceTranslations);
  return { title: localized.metaTitle };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = safeInterfaceLanguage(lang);
  const t = locale === "zh" ? copy.zh : translateHomeCopy(copy.en, locale, homeInterfaceTranslations);
  const ui = interfaceCopyFor(locale);
  const tutorial = smartLingoTutorialCopyFor(locale);
  return (
    <main className="lingo-home" data-layout-page="home">
      <div className="lingo-hero-shell" data-layout-fill="home-hero-shell">
        <SiteHeader lang={locale}/>
        <section className="lingo-hero">
          <div className="lingo-hero-copy" data-readable-copy="home-hero-copy">
            <p className="section-kicker">{t.eyebrow}</p>
            <h2 data-layout-text-fit="home-hero-title">{t.title}</h2>
            <p>{t.intro}</p>
            <Link className="lingo-tour-spotlight" href={`/${locale}/tutorial`}>
              <span aria-hidden="true">▶</span>
              <strong>{tutorial.homeAction}</strong>
              <small>{tutorial.duration}</small>
            </Link>
            <div className="lingo-actions">
              <Link className="primary-button" href={`/${locale}/play/everyday`}>{ui.everyday} →</Link>
              <Link className="secondary-button" href={`/${locale}/play?language=${locale}`}>{ui.play}</Link>
              <Link className="secondary-button" href={`/${locale}/programs`}>{ui.courses}</Link>
              <Link className="text-link" href={`/${locale}/assistant`}>{ui.askAi}</Link>
            </div>
            <div className="lingo-trust">{t.trust.map(item => <span key={item}>✓ {item}</span>)}</div>
          </div>
          <PlayDailySprintPicker lang={locale} initialLanguage={locale} triggerClassName="lingo-hero-visual" triggerLabel={ui.openSprint}>
            <Image
              className="lingo-community-art"
              src="/smartlingo-language-community-1600.png"
              width={1600}
              height={858}
              alt={ui.communityArtAlt}
              unoptimized
            />
          <div className="lingo-coach-card">
            <header><span>{t.coachLabel}</span><b>12 XP</b></header>
            <h2>{t.coachTitle}</h2>
            <p>{t.coachPrompt}</p>
            <div className="lingo-listening"><span aria-hidden="true">●</span>{t.coachStatus}</div>
            <dl>{t.skills.map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{score}</dd></div>)}</dl>
            <strong className="lingo-task-action">{ui.startSprint} →</strong>
          </div>
          </PlayDailySprintPicker>
        </section>
      </div>
      <section className="lingo-section lingo-loop-section">
        <div className="lingo-heading"><p className="section-kicker">{t.loopKicker}</p><h2>{t.loopTitle}</h2><p>{t.loopBody}</p></div>
        <div className="lingo-loop-grid">{t.loop.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="lingo-section lingo-social-section">
        <div className="lingo-heading"><p className="section-kicker">{t.socialKicker}</p><h2>{t.socialTitle}</h2></div>
        <div className="lingo-social-grid">{t.social.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        <Link className="primary-button" href={`/${locale}/classes`}>{ui.browseCourses} →</Link><Link className="secondary-button" href={`/${locale}/classes?mine=1`}>{ui.myCourses} →</Link>
      </section>

      <section className="lingo-ready"><h2>{t.readyTitle}</h2><p>{t.readyBody}</p><div className="lingo-actions"><Link className="primary-button" href={`/${locale}/auth/sign-up`}>{t.readyAction} →</Link><Link className="secondary-button" href={`/${locale}/programs`}>{ui.viewPaths}</Link></div></section>
      <PlatformPlans lang={locale} compact/>
      <SiteFooter lang={locale}/>
    </main>
  );
}
