import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeLearningChoices } from "../../components/HomeLearningChoices";
import { PlayDailySprintPicker } from "../../components/PlayDailySprintPicker";
import { JoinCollegeByCode } from "../../components/JoinCollegeByCode";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

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
    classKicker: "THREE COURSE LEVELS",
    classTitle: "Choose the depth of training that fits your goal.",
    classBody: "Every language has Beginner, Intermediate, and Advanced courses maintained by SmartLingo administrators, with an A/V Webinar teaching room and a free group-audio practice room.",
    classCards: [
      ["Beginner · $20/month", "Core vocabulary, pronunciation, listening, and guided speaking."],
      ["Intermediate · $100/month", "Adds daily-life dialogue and writing training."],
      ["Advanced · $300/month", "Adds accent correction, speech training, and speech-draft revision."],
    ],
    moneyKicker: "SIMPLE SUBSCRIPTION",
    moneyTitle: "Your first month is free.",
    moneyBody: "Start a course without a charge today. After 30 days, the fixed monthly price applies until cancellation. Members cannot create courses or set fees.",
    moneyAction: "Action Now",
    moneyFacts: [
      ["30 days", "Free first month for every course subscription"],
      ["3 levels", "Beginner, Intermediate, and Advanced"],
      ["2 rooms", "A Webinar teaching room and group-audio practice room for each course"],
    ],
    rewardTitle: "Three point types stay separate and auditable.",
    rewardBody: "Learning XP tracks motivation and has no cash value. Verified SmartCard challenge points can offset only a SmartLingo course month. Direct-introducer rewards remain limited to qualifying platform-subscription payments; course purchases, payouts, tips, and refunds never create them.",
    socialKicker: "LEARN WITH PEOPLE",
    socialTitle: "A language course should feel alive between lessons.",
    social: [
      ["Course Community", "Topics, questions, study notes, announcements, moderation, and classmates who share the same learning context."],
      ["Messages & Live Chat", "Direct and group conversations with replies, attachments, notifications, presence, and safe reporting tools."],
      ["AI Guru & live audio", "Public text guidance and signed-in microphone or live-audio practice with course context and usage controls."],
      ["Progress that helps", "Daily goals, skill mastery, streaks, course milestones, and privacy-safe aggregate teacher views."],
    ],
    planKicker: "COMPETITIVE BY DESIGN",
    planTitle: "Start with a free month, then choose the depth you need.",
    planBody: "Every language uses the same transparent monthly prices and includes a Webinar teaching room plus a group-audio practice room.",
    plans: [
      ["Beginner · $20/month", "Core vocabulary, pronunciation, listening, and guided speaking."],
      ["Intermediate · $100/month", "Beginner training plus daily-life dialogue and writing."],
      ["Advanced · $300/month", "Intermediate training plus accent correction, speeches, and speech-draft revision."],
    ],
    readyTitle: "Choose a language and say the first sentence today.",
    readyBody: "Choose a fixed course level, use the first month free, and keep learning, teaching, and speaking practice together.",
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
    classKicker: "三级课程",
    classTitle: "按学习目标选择合适的训练深度。",
    classBody: "每种语言都有由 SmartLingo 管理员维护的初期、中级和高级课程；每门课程配有音视频 Webinar 课程教室和免费的 Group Audio 练习室。",
    classCards: [
      ["初期 · 每月 20 美元", "核心词汇、发音、听力和引导式口语。"],
      ["中级 · 每月 100 美元", "增加日常生活对话和写作训练。"],
      ["高级 · 每月 300 美元", "增加口音校正、演讲训练和演讲稿修改。"],
    ],
    moneyKicker: "简单订阅",
    moneyTitle: "第一个月免费。",
    moneyBody: "今天开通课程不会收费；30 天后按固定月费续订，直至取消。会员不能创建课程或自行定价。",
    moneyAction: "立即行动",
    moneyFacts: [
      ["30 天", "每门课程订阅的免费首月"],
      ["三级", "初期、中级和高级"],
      ["两个房间", "每门课程都有 Webinar 课程教室和小组语音练习室"],
    ],
    rewardTitle: "三类积分独立记账、可追溯。",
    rewardBody: "学习 XP 只表示动力和进度，没有现金价值；经验证的 SmartCard 挑战积分只能抵 SmartLingo 课程月费；直接介绍人积分仍只来自符合规则的平台订阅付款，课程购买、收款、打赏和退款都不会产生介绍人积分。",
    socialKicker: "和真实的人一起学习",
    socialTitle: "一门语言班，在下课后也应该保持活力。",
    social: [
      ["课程社区", "主题、提问、学习笔记、公告、治理工具，以及拥有相同学习背景的同班同学。"],
      ["消息与实时聊天", "私聊和群聊支持回复、附件、通知、在线状态与安全举报。"],
      ["人工智能导师与实时语音", "公开文字帮助；登录后使用麦克风或实时语音，并按课程上下文练习。"],
      ["真正有帮助的进度", "每日目标、技能掌握、连续学习、课程里程碑，以及保护隐私的老师汇总视图。"],
    ],
    planKicker: "以更有竞争力的价值设计",
    planTitle: "首月免费，再选择需要的训练深度。",
    planBody: "每种语言采用相同透明月费，并配有 Webinar 课程教室和小组语音练习室。",
    plans: [
      ["初期 · 每月 20 美元", "核心词汇、发音、听力和引导式口语。"],
      ["中级 · 每月 100 美元", "初期训练加日常生活对话和写作。"],
      ["高级 · 每月 300 美元", "中级训练加口音校正、演讲和演讲稿修改。"],
    ],
    readyTitle: "今天就选一种语言，说出第一句话。",
    readyBody: "选择固定课程等级，使用免费首月，把学习、授课与口语练习连接在一起。",
    readyAction: "免费创建账户",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") return {};
  return { title: copy[lang].metaTitle };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== "en" && lang !== "zh") redirect("/");
  const t = copy[lang];
  return (
    <main className="lingo-home" data-layout-page="home">
      <div className="lingo-hero-shell" data-layout-fill="home-hero-shell">
        <SiteHeader lang={lang}/>
        <section className="lingo-hero">
          <div className="lingo-hero-copy" data-readable-copy="home-hero-copy">
            <p className="section-kicker">{t.eyebrow}</p>
            <h2 data-layout-text-fit="home-hero-title">{t.title}</h2>
            <p>{t.intro}</p>
            <div className="lingo-actions">
              <Link className="primary-button" href="#home-everyday">{lang === "zh" ? "生活口语" : "Everyday speaking"} →</Link>
              <Link className="secondary-button" href={`/${lang}/play?language=${lang}`}>{lang === "zh" ? "边玩边学" : "Learn through play"}</Link>
              <Link className="secondary-button" href="#home-courses">{lang === "zh" ? "选择课程" : "Choose course"}</Link>
              <Link className="secondary-button" href="#home-colleges">{lang === "zh" ? "选择学院" : "Choose College"}</Link>
              <Link className="text-link" href="#home-ai">{lang === "zh" ? "咨询AI" : "Ask AI"}</Link>
            </div>
            <div className="lingo-trust">{t.trust.map(item => <span key={item}>✓ {item}</span>)}</div>
          </div>
          <PlayDailySprintPicker lang={lang} initialLanguage={lang} triggerClassName="lingo-hero-visual" triggerLabel={lang === "zh" ? "打开今日速成，选择语言和时长" : "Open Today’s Sprint and choose a language and time"}>
            <img
              className="lingo-community-art"
              src="/smartlingo-language-community-1600.png"
              width="1600"
              height="858"
              alt={lang === "zh" ? "来自不同背景的学习者在人工智能语音导师帮助下共同练习语言" : "Learners from different backgrounds practicing language together with an AI voice coach"}
            />
          <div className="lingo-coach-card">
            <header><span>{t.coachLabel}</span><b>12 XP</b></header>
            <h2>{t.coachTitle}</h2>
            <p>{t.coachPrompt}</p>
            <div className="lingo-listening"><span aria-hidden="true">●</span>{t.coachStatus}</div>
            <dl>{t.skills.map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{score}</dd></div>)}</dl>
            <strong className="lingo-task-action">{lang === "zh" ? "开始今日速成" : "Start Today’s Sprint"} →</strong>
          </div>
          </PlayDailySprintPicker>
        </section>
      </div>
      <HomeLearningChoices lang={lang}/>

      <section className="lingo-section lingo-loop-section">
        <div className="lingo-heading"><p className="section-kicker">{t.loopKicker}</p><h2>{t.loopTitle}</h2><p>{t.loopBody}</p></div>
        <div className="lingo-loop-grid">{t.loop.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="lingo-section lingo-class-section" id="home-courses">
        <div className="lingo-heading"><p className="section-kicker">{t.classKicker}</p><h2>{t.classTitle}</h2><p>{t.classBody}</p></div>
        <div className="lingo-class-grid">{t.classCards.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <Link className="primary-button" href={`/${lang}/classes`}>{t.classes} →</Link>
      </section>

      <section className="lingo-section lingo-college-section" id="home-colleges" data-layout-fill="home-colleges">
        <div className="lingo-heading"><p className="section-kicker">COLLEGES</p><h2>{lang==="zh"?"进入一个连接课程与同学的学院。":"Enter a college that connects courses and learners."}</h2><p>{lang==="zh"?"输入学院编号直达，或浏览学院与我的学院。每个学院都有导论课程和自己的课程表。":"Enter a college number, browse all colleges, or return to My colleges. Every college has an introductory course and its own course table."}</p></div>
        <JoinCollegeByCode lang={lang}/>
        <div className="college-directory-actions"><Link className="primary-button" href={`/${lang}/colleges`}>{lang==="zh"?"浏览学院":"Browse colleges"}</Link><Link className="secondary-button" href={`/${lang}/colleges?view=mine`}>{lang==="zh"?"我的学院":"My colleges"}</Link></div>
      </section>

      <section className="lingo-money-section">
        <div className="lingo-money-intro" data-layout-track="home-subscription-intro" data-layout-overlap-check="home-subscription-intro">
          <div className="lingo-heading"><p className="section-kicker">{t.moneyKicker}</p><h2>{t.moneyTitle}</h2><p>{t.moneyBody}</p></div>
          <Link className="primary-button lingo-money-cta" href={`/${lang}/programs`}>{t.moneyAction} →</Link>
        </div>
        <div className="lingo-money-facts">{t.moneyFacts.map(([value, label]) => <article key={value}><strong>{value}</strong><p>{label}</p></article>)}</div>
        <aside><h3>{t.rewardTitle}</h3><p>{t.rewardBody}</p></aside>
      </section>

      <section className="lingo-section lingo-social-section">
        <div className="lingo-heading"><p className="section-kicker">{t.socialKicker}</p><h2>{t.socialTitle}</h2></div>
        <div className="lingo-social-grid">{t.social.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
        <Link className="primary-button" href={`/${lang}/classes`}>{lang === "zh" ? "浏览课程" : "Browse Courses"} →</Link><Link className="secondary-button" href={`/${lang}/classes?mine=1`}>{lang === "zh" ? "我的课程" : "My Courses"} →</Link>
      </section>

      <section className="lingo-section lingo-plan-section">
        <div className="lingo-heading"><p className="section-kicker">{t.planKicker}</p><h2>{t.planTitle}</h2><p>{t.planBody}</p></div>
        <div className="lingo-plan-grid">{t.plans.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p><Link href={`/${lang}/programs`}>{lang === "zh" ? "选择语言" : "Choose language"} →</Link></article>)}</div>
      </section>

      <section className="lingo-ready"><h2>{t.readyTitle}</h2><p>{t.readyBody}</p><div className="lingo-actions"><Link className="primary-button" href={`/${lang}/auth/sign-up`}>{t.readyAction} →</Link><Link className="secondary-button" href={`/${lang}/programs`}>{lang === "zh" ? "查看学习路径" : "View learning paths"}</Link></div></section>
      <SiteFooter lang={lang}/>
    </main>
  );
}
