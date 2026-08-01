import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";

const copy = {
  en: {
    metaTitle: "SmartLingo — Speak from day one",
    eyebrow: "AI-NATIVE LANGUAGE LEARNING",
    title: "Speak a new language from day one.",
    intro: "Practice real situations with an AI Guru, receive clear corrections, and keep learning with a teacher-led class and its own social community.",
    start: "Start learning free",
    classes: "Explore classes",
    voice: "Try Ask Guru",
    trust: ["7 target languages", "Four-skill practice", "Class communities"],
    coachLabel: "TODAY · SPEAKING PRACTICE",
    coachTitle: "Order lunch with confidence",
    coachPrompt: "Tell the server what you would like, ask about an ingredient, then confirm the order.",
    coachStatus: "AI Guru is ready to listen",
    skills: [["Listening", "84"], ["Speaking", "72"], ["Reading", "91"], ["Writing", "76"]],
    languagesKicker: "CHOOSE YOUR PATH",
    languagesTitle: "Seven languages, one connected learning loop.",
    languagesBody: "The original SmartLingo language choices remain the starting catalog. Every path combines short lessons, practical vocabulary, comprehension, writing, and live conversation.",
    languages: [
      ["🇪🇸", "Spanish", "Travel, community, and everyday work"],
      ["🇬🇧", "English", "Global study, work, and communication"],
      ["🇫🇷", "French", "Travel, culture, and international communication"],
      ["🇯🇵", "Japanese", "Travel, media, and neighboring cultures"],
      ["🇩🇪", "German", "Engineering, study, and business"],
      ["🇮🇹", "Italian", "Art, food, travel, and culture"],
      ["🇰🇷", "Korean", "Travel, entertainment, and conversation"],
    ],
    loopKicker: "NOT JUST WORD LISTS",
    loopTitle: "Listen, speak, read, write—and return to what needs work.",
    loopBody: "SmartLingo uses short daily tasks, spaced review, transparent skill scores, and human-visible progress. AI feedback supports practice; it never pretends to be a human teacher or an official exam result.",
    loop: [
      ["01", "Learn", "Follow an adaptive path with compact lessons, original examples, vocabulary cards, and a daily goal."],
      ["02", "Practice", "Complete focused listening, speaking, reading, and writing tasks based on your current level."],
      ["03", "Talk", "Use text or signed-in live audio with the AI Guru in course-defined real-life scenarios."],
      ["04", "Review", "Return to mistakes and due vocabulary; keep a streak without losing access when life interrupts."],
    ],
    classKicker: "MEMBER-LED LEARNING",
    classTitle: "Create a class. Coordinate learners. Build a real community.",
    classBody: "A signed-in member can open a private class as its teacher or coordinator, choose an approved learning path, invite students, set a schedule, and run a class Community with topics, direct messages, group Live Chat, and shared goals.",
    classCards: [
      ["Teacher studio", "Choose a language, level, curriculum snapshot, class price, schedule, capacity, and community rules."],
      ["Student journey", "Join by class link, complete daily learning, ask the Guru, and learn socially without exposing private answers."],
      ["Class operations", "Track attendance and aggregate progress, publish announcements, assign tasks, and support learners who fall behind."],
    ],
    moneyKicker: "CLEAR CLASS ECONOMICS",
    moneyTitle: "The class owner earns 70%. The platform receives 30%.",
    moneyBody: "The planned Stripe Connect flow calculates the split from the actual discounted, pre-tax class amount. A learner’s first payment in a class receives 15% off once. Real checkout stays disabled until the connected account, tax, refunds, and webhooks are production-verified.",
    moneyFacts: [
      ["85%", "First eligible class payment after the 15% discount"],
      ["70%", "Class owner share of the discounted pre-tax amount"],
      ["30%", "Platform application fee before payment-processing costs"],
    ],
    rewardTitle: "Introducer rewards apply only to platform subscriptions.",
    rewardBody: "When the platform successfully charges a recurring SmartLingo subscription, its direct introducer can receive the published reward points for that payment. Class purchases, teacher payouts, refunds, tips, and connected-account charges never create introducer points.",
    socialKicker: "LEARN WITH PEOPLE",
    socialTitle: "A language class should feel alive between lessons.",
    social: [
      ["Class Community", "Topics, questions, study notes, announcements, moderation, and classmates who share the same learning context."],
      ["Messages & Live Chat", "Direct and group conversations with replies, attachments, notifications, presence, and safe reporting tools."],
      ["AI Guru & live audio", "Public text guidance and signed-in microphone or live-audio practice with course context and usage controls."],
      ["Progress that helps", "Daily goals, skill mastery, streaks, class milestones, and privacy-safe aggregate teacher views."],
    ],
    planKicker: "COMPETITIVE BY DESIGN",
    planTitle: "Start free. Pay for deeper practice, coordination, and live-class value.",
    planBody: "SmartLingo keeps the foundation usable for free and shows regional subscription prices at checkout. Comparisons use current checkout prices instead of hard-coding a competitor’s changing regional price.",
    plans: [
      ["Free", "Core learning path, daily practice, Community, and public text Guru."],
      ["Plus", "Expanded review, live-audio allowance, deeper progress insights, and member class tools."],
      ["Class", "Owner-set class price, first-payment discount, teacher coordination, and a private class community."],
    ],
    readyTitle: "Choose a language and say the first sentence today.",
    readyBody: "Learn independently, join a class, or create one for your own community. Your progress, conversations, and class relationships stay connected in one place.",
    readyAction: "Create free account",
  },
  zh: {
    metaTitle: "SmartLingo — 从第一天开口",
    eyebrow: "人工智能原生语言学习",
    title: "从第一天开始，开口说一门新语言。",
    intro: "和人工智能导师练习真实场景，当场获得清楚纠正；也可以加入老师带领的班级，在自己的学习社区里一起进步。",
    start: "免费开始学习",
    classes: "浏览语言班",
    voice: "试用智能导师",
    trust: ["七种目标语言", "听说读写训练", "班级学习社区"],
    coachLabel: "今日任务 · 口语练习",
    coachTitle: "自信地完成一次点餐",
    coachPrompt: "告诉服务员您想点什么，询问一种配料，然后确认订单。",
    coachStatus: "人工智能导师已准备聆听",
    skills: [["听力", "84"], ["口语", "72"], ["阅读", "91"], ["写作", "76"]],
    languagesKicker: "选择学习路径",
    languagesTitle: "七种语言，同一套完整学习闭环。",
    languagesBody: "原 SmartLingo 的七种语言选择继续作为首批目录。每条路径都把短课、实用词汇、理解、写作和实时对话连接起来。",
    languages: [
      ["🇪🇸", "西班牙语", "旅行、社区与日常工作"],
      ["🇬🇧", "英语", "全球学习、工作与沟通"],
      ["🇫🇷", "法语", "旅行、文化与国际交流"],
      ["🇯🇵", "日语", "旅行、媒体与邻国文化"],
      ["🇩🇪", "德语", "工程、留学与商务"],
      ["🇮🇹", "意大利语", "艺术、美食、旅行与文化"],
      ["🇰🇷", "韩语", "旅行、娱乐与日常会话"],
    ],
    loopKicker: "不只是背单词",
    loopTitle: "听、说、读、写，再回到真正需要加强的地方。",
    loopBody: "SmartLingo 使用每日短任务、间隔复习、透明技能分和可见进度。人工智能反馈用于辅助练习，不冒充真人教师，也不把练习分数写成官方考试结果。",
    loop: [
      ["01", "学习", "沿着自适应路径完成短课、原创例句、词汇卡和每日目标。"],
      ["02", "训练", "根据当前水平完成针对性的听力、口语、阅读和写作任务。"],
      ["03", "对话", "用文字或登录后的实时语音，与人工智能导师练习课程定义的真实场景。"],
      ["04", "复习", "回到错题和到期词汇；中断学习不会失去课程使用权，可重新继续。"],
    ],
    classKicker: "会员自主开班",
    classTitle: "创建语言班，协调学习者，建立真正的学习社区。",
    classBody: "登录会员可以作为老师或协调员创建私有班级，选择经批准的学习路径、邀请学员、设置日程，并运营带主题、私信、群组实时聊天和共同目标的班级社区。",
    classCards: [
      ["老师工作室", "选择语言、等级、课程快照、班级价格、日程、人数与社区规则。"],
      ["学员路径", "通过班级链接加入，完成每日学习、询问导师，并在不暴露私密作答的前提下共同学习。"],
      ["班级运营", "查看出勤与汇总进度、发布公告、布置任务，并支持学习进度落后的学员。"],
    ],
    moneyKicker: "清楚透明的班级分账",
    moneyTitle: "班主获得 70%，平台获得 30%。",
    moneyBody: "计划采用 Stripe Connect，以实际折后、税前班级金额计算分账。每位学员在每个班级的首次付款可享一次 15% 优惠。连接账户、税务、退款与回调通过生产验证前，真实结账保持关闭。",
    moneyFacts: [
      ["85%", "首次符合条件的班级付款，应用八五折后金额"],
      ["70%", "班主获得折后税前金额的七成"],
      ["30%", "平台应用费，尚未扣除支付处理成本"],
    ],
    rewardTitle: "介绍人积分只来自平台订阅付款。",
    rewardBody: "平台每次成功收取 SmartLingo 订阅费后，该用户的直接介绍人可按已公布规则获得积分。班级购买、老师收款、退款、打赏和连接账户付款一律不产生介绍人积分。",
    socialKicker: "和真实的人一起学习",
    socialTitle: "一门语言班，在下课后也应该保持活力。",
    social: [
      ["班级社区", "主题、提问、学习笔记、公告、治理工具，以及拥有相同学习背景的同班同学。"],
      ["消息与实时聊天", "私聊和群聊支持回复、附件、通知、在线状态与安全举报。"],
      ["人工智能导师与实时语音", "公开文字帮助；登录后使用麦克风或实时语音，并按课程上下文练习。"],
      ["真正有帮助的进度", "每日目标、技能掌握、连续学习、班级里程碑，以及保护隐私的老师汇总视图。"],
    ],
    planKicker: "以更有竞争力的价值设计",
    planTitle: "免费开始，为更深入的训练、班级协调和实时互动付费。",
    planBody: "SmartLingo 保留可用的免费基础，并在结账时显示地区订阅价。与其他平台比较时采用当时的实际结账价，不把会随地区变化的竞争者价格写死。",
    plans: [
      ["免费方案", "基础学习路径、每日训练、社区与公开文字导师。"],
      ["进阶方案", "更多复习、实时语音额度、深入进度分析与会员开班工具。"],
      ["语言班", "班主自定价格、首次付款优惠、老师协调和私有班级社区。"],
    ],
    readyTitle: "今天就选一种语言，说出第一句话。",
    readyBody: "可以自己学、加入语言班，也可以为自己的社区创建班级。学习进度、对话和班级关系都在同一个地方持续连接。",
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
  if (lang !== "en" && lang !== "zh") notFound();
  const t = copy[lang];
  return (
    <main className="lingo-home">
      <div className="lingo-hero-shell">
        <SiteHeader lang={lang}/>
        <section className="lingo-hero">
          <div className="lingo-hero-copy">
            <p className="section-kicker">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
            <div className="lingo-actions">
              <Link className="primary-button" href={`/${lang}/auth/sign-up`}>{t.start} →</Link>
              <Link className="secondary-button" href={`/${lang}/classes`}>{t.classes}</Link>
              <Link className="text-link" href={`/${lang}/assistant`}>{t.voice}</Link>
            </div>
            <div className="lingo-trust">{t.trust.map(item => <span key={item}>✓ {item}</span>)}</div>
          </div>
          <div className="lingo-hero-visual">
            <img
              className="lingo-community-art"
              src="/smartlingo-language-community-1600.png"
              width="1600"
              height="858"
              alt={lang === "zh" ? "来自不同背景的学习者在人工智能语音导师帮助下共同练习语言" : "Learners from different backgrounds practicing language together with an AI voice coach"}
            />
          <aside className="lingo-coach-card" aria-label={lang === "zh" ? "语言训练示例" : "Language practice example"}>
            <header><span>{t.coachLabel}</span><b>12 XP</b></header>
            <div className="lingo-speech-orb" aria-hidden="true"><i/><i/><i/><i/></div>
            <h2>{t.coachTitle}</h2>
            <p>{t.coachPrompt}</p>
            <div className="lingo-listening"><span aria-hidden="true">●</span>{t.coachStatus}</div>
            <dl>{t.skills.map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{score}</dd></div>)}</dl>
          </aside>
          </div>
        </section>
      </div>

      <section className="lingo-section lingo-language-section">
        <div className="lingo-heading"><p className="section-kicker">{t.languagesKicker}</p><h2>{t.languagesTitle}</h2><p>{t.languagesBody}</p></div>
        <div className="lingo-language-grid">{t.languages.map(([flag, name, note]) => <article key={name}><span>{flag}</span><div><h3>{name}</h3><p>{note}</p></div><b aria-hidden="true">→</b></article>)}</div>
      </section>

      <section className="lingo-section lingo-loop-section">
        <div className="lingo-heading"><p className="section-kicker">{t.loopKicker}</p><h2>{t.loopTitle}</h2><p>{t.loopBody}</p></div>
        <div className="lingo-loop-grid">{t.loop.map(([number, title, body]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="lingo-section lingo-class-section">
        <div className="lingo-heading"><p className="section-kicker">{t.classKicker}</p><h2>{t.classTitle}</h2><p>{t.classBody}</p></div>
        <div className="lingo-class-grid">{t.classCards.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <Link className="primary-button" href={`/${lang}/classes`}>{t.classes} →</Link>
      </section>

      <section className="lingo-money-section">
        <div className="lingo-heading"><p className="section-kicker">{t.moneyKicker}</p><h2>{t.moneyTitle}</h2><p>{t.moneyBody}</p></div>
        <div className="lingo-money-facts">{t.moneyFacts.map(([value, label]) => <article key={value}><strong>{value}</strong><p>{label}</p></article>)}</div>
        <aside><h3>{t.rewardTitle}</h3><p>{t.rewardBody}</p></aside>
      </section>

      <section className="lingo-section lingo-social-section">
        <div className="lingo-heading"><p className="section-kicker">{t.socialKicker}</p><h2>{t.socialTitle}</h2></div>
        <div className="lingo-social-grid">{t.social.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="lingo-section lingo-plan-section">
        <div className="lingo-heading"><p className="section-kicker">{t.planKicker}</p><h2>{t.planTitle}</h2><p>{t.planBody}</p></div>
        <div className="lingo-plan-grid">{t.plans.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p><Link href={`/${lang}/pricing`}>{lang === "zh" ? "查看详情" : "View details"} →</Link></article>)}</div>
      </section>

      <section className="lingo-ready"><h2>{t.readyTitle}</h2><p>{t.readyBody}</p><div className="lingo-actions"><Link className="primary-button" href={`/${lang}/auth/sign-up`}>{t.readyAction} →</Link><Link className="secondary-button" href={`/${lang}/programs`}>{lang === "zh" ? "查看学习路径" : "View learning paths"}</Link></div></section>
      <SiteFooter lang={lang}/>
    </main>
  );
}
