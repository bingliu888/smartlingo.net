import { smartLingoRoadmapTasks } from "./smartlingo-roadmap";

export type ProjectTask = {
  id: string;
  date: string;
  status: "done" | "planned" | "blocked";
  progress: number;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  category: { zh: string; en: string };
  owner: { zh: string; en: string };
};

export type ProjectBuild = {
  version: number;
  date: string;
  title: { zh: string; en: string };
  completed: { zh: string[]; en: string[] };
  testable: { zh: string[]; en: string[] };
  commit: string;
};

export type ProjectReport = {
  date: string;
  title: { zh: string; en: string };
  beta: { zh: string; en: string };
  completed: number;
  summary: { zh: string; en: string };
  validation: { zh: string[]; en: string[] };
  rollback: { zh: string; en: string };
  next: { zh: string; en: string };
};

export const projectStats = {
  editionDate: "2026-08-16",
  today: 1,
  total: 101,
};

// A release appears here only after the same revision has verifiable Sites,
// GitHub, and production-domain evidence. Version 5 is the first revision to
// satisfy all three evidence sources.
export const projectBuilds: ProjectBuild[] = [
  {
    version: 5,
    date: "2026-08-01",
    title: {
      zh: "SmartLingo 身份基础与正式生产验收版本",
      en: "SmartLingo identity foundation and production acceptance release",
    },
    completed: {
      zh: [
        "完成 Clerk 邮箱验证码、D1 核心模型、R2 私有媒体与统一人工智能网关",
        "启用正式域名、带 www 前缀域名、独立身份域名与安全证书",
        "修复推荐入口生产错误，并用真实用户验证三条单层推荐关系与零注册积分",
        "验收个人资料、头像、私有开班、社区、私信、群组实时聊天、附件与智能导师",
        "通过完整发布门槛、多视口双语测量，并将相同提交同步到 GitHub main",
      ],
      en: [
        "Completed Clerk email-code identity, the D1 core model, private R2 media, and the unified AI gateway",
        "Activated the apex, WWW, dedicated identity domain, and secure certificates",
        "Fixed the production referral-entry error and verified three single-level relationships with zero signup points",
        "Accepted profile, avatar, private class creation, Community, direct messages, group Live Chat, attachment, and Guru flows",
        "Passed the full release gate and bilingual multi-viewport measurements, then synchronized the same commit to GitHub main",
      ],
    },
    testable: {
      zh: [
        "打开中英文首页、班级、课程、登录与项目中心",
        "在项目日历选择 2026 年 8 月 1 日并确认当天五项均有完成证据",
        "从 test1 推荐链接登录 test2、test3 或 test4，并在账户页查看介绍关系",
        "检查公开智能导师、登录后语音入口、社区、私信与群组实时聊天",
      ],
      en: [
        "Open the Chinese and English Home, Classes, Programs, sign-in, and Project surfaces",
        "Select August 1, 2026 in Project and confirm that all five tasks have completion evidence",
        "Sign in test2, test3, or test4 from test1's referral link and inspect attribution on the account page",
        "Check public Guru, the signed-in voice entry, Community, direct messages, and group Live Chat",
      ],
    },
    commit: "a4389a5edfa6d73cb5471d2c564625d041054a2b",
  },
  { version: 6, date: "2026-08-16", title: { zh: "实时课堂媒体隔离发布 · 2026-08-16 10:33 PDT", en: "Realtime classroom media isolation release · 2026-08-16 10:33 PDT" }, completed: { zh: ["确认旧候场广播运行时代码已删除", "候场播放列表保持访客本地播放", "修复举手失败误报与设备权限切换时序", "保留幽灵主播、无人观看自动离开及无效网址回首页保护"], en: ["Confirmed obsolete waiting-playlist broadcast runtime code is removed", "Kept waiting playlists in visitor-local playback", "Fixed false hand-raise success and device-permission connection timing", "Preserved ghost-publisher, no-viewer auto-leave, and unknown-URL home redirect safeguards"] }, testable: { zh: ["运行实时课堂契约测试", "构建并验证生产版本"], en: ["Run realtime classroom contract tests", "Build and verify the production bundle"] }, commit: "smartlingo-realtime-media-isolation-2026-08-16" },
];

export const projectTasks: ProjectTask[] = smartLingoRoadmapTasks;

export const projectReports: ProjectReport[] = [
  {
    date: "2026-07-31",
    title: {
      zh: "SmartLingo 迁移与产品基础检查点",
      en: "SmartLingo migration and product-foundation checkpoint",
    },
    beta: {
      zh: "查看首日五项任务证据",
      en: "Review evidence for the first five tasks",
    },
    completed: 5,
    summary: {
      zh: "已保存旧站可见内容，建立 SmartLingo 独立代码与通用界面基础，固定语言学习、会员开班、班级收费和推荐积分边界，并发布二十天共一百项路线图。此检查点不代表已完成 Sites、GitHub 或正式域名发布。",
      en: "The visible legacy site is archived, SmartLingo has an independent code and shared-UI foundation, and the language-learning, member-created-class, class-commerce, and referral-reward boundaries are fixed in a twenty-day, 100-task roadmap. This checkpoint does not represent a completed Sites, GitHub, or production-domain release.",
    },
    validation: {
      zh: [
        "旧站首页、欢迎页、图标和社交分享图已按文件大小与校验值留档",
        "路线图从 2026 年 7 月 31 日起连续二十天，每天恰好五项，共一百个唯一任务",
        "班级首笔付款优惠百分之十五，优惠后税前金额按班主百分之七十、平台百分之三十分配",
        "只有平台订阅成功付款可产生直接介绍人积分，班级付款不产生介绍人积分",
        "真实结账、连接账户、域名切换和生产发布在各自通过验收前保持关闭或不变",
      ],
      en: [
        "The legacy home, welcome page, icons, and social preview are archived with file sizes and checksums",
        "The roadmap spans twenty consecutive days from July 31, 2026, with exactly five tasks per day and 100 unique tasks",
        "A first class payment receives 15% off, then the discounted pre-tax amount splits 70% to the owner and 30% to the platform",
        "Only successful platform subscription payments can create direct-introducer points; class payments create none",
        "Live checkout, connected accounts, domain cutover, and production release remain off or unchanged until their own acceptance gates pass",
      ],
    },
    rollback: {
      zh: "当前记录仅描述迁移基础，尚未替换正式站点，因此没有需要声称已完成的生产回滚；旧站留档可用于内容核对。",
      en: "This record covers only the migration foundation and has not replaced the production site, so there is no completed production rollback to claim; the legacy archive remains available for content comparison.",
    },
    next: {
      zh: "按最早未完成日期推进身份、数据、媒体和智能服务基础，并在证据齐全后再记录发布版本。",
      en: "Continue with identity, data, media, and AI foundations from the earliest unfinished date, and record a release only after evidence is complete.",
    },
  },
  {
    date: "2026-08-01",
    title: {
      zh: "SmartLingo 身份、数据、媒体与智能服务基础日报",
      en: "SmartLingo identity, data, media, and AI foundation report",
    },
    beta: {
      zh: "查看当天五项完成证据",
      en: "Review evidence for all five completions",
    },
    completed: 5,
    summary: {
      zh: "当天恰好完成五项：Clerk 邮箱验证码身份、D1 核心模型、R2 私有媒体、统一人工智能网关与基础设施隔离测试均已有代码、配置和正式域名证据。首位用户及四名测试用户完成真实 Safari 登录；test2、test3、test4 通过 test1 的单层推荐链接建立关系，注册不产生积分。推荐入口的生产 500 根因已修复并加入运行时回归测试。",
      en: "Exactly five tasks are complete: Clerk email-code identity, the D1 core model, private R2 media, the unified AI gateway, and infrastructure-isolation tests all have code, configuration, and production-domain evidence. The first user and four test users completed real Safari sign-in; test2, test3, and test4 established single-level attribution through test1's link, with no signup points. The production referral-entry 500 was fixed and covered by a runtime regression test.",
    },
    validation: {
      zh: [
        "0018 迁移加入原创双语练习、版本化进度、整分订单约束、首次支付单次优惠和只由已付款平台订阅支持的直接介绍人积分关系；迁移可重复执行",
        "七类私有媒体执行内容签名、大小、所有权与范围约束；班级封面、语音练习和聊天附件具备授权读取与可重试删除",
        "人工智能网关统一公开导师、听说写反馈和安全审核，使用键控主体哈希、原子限流、完整响应体超时、审计与不冒充真人教师的回退",
        "Clerk 生产应用、独立域名和 SSL 已启用；注册时不强制设置密码，用户可在账户中后续添加密码",
        "首位用户及四名测试用户完成真实 Safari 登录；首位用户无错误介绍人，test1 有三名直接介绍用户且所有注册积分均为零",
        "有效推荐码曾因向重定向响应的不可变响应头追加推荐记录文件而在生产返回 500；现在一次性构造 302、跳转地址与安全推荐记录文件，并由真实边缘运行路由测试覆盖",
        "个人资料与头像、私有开班、公共社区主题和回复、私信及智能导师润色、直接与群组实时聊天、附件、未读通知、公开智能导师和登录语音入口均在正式域名完成真实验收",
        "中英文首页、班级、课程、登录、社区、消息、群组实时聊天、智能导师、项目日历、当日任务与日报已在五个发布视口完成 110 项运行时测量；无横向溢出、裁切、重叠、关键省略或悬浮入口遮挡",
        "完整门禁包括全部 D1 迁移、全量测试、TypeScript、ESLint、vinext 生产构建、产物验证与客户端敏感信息扫描；任一失败均阻止发布",
        "主域与带 www 前缀的站点域名、提供商状态和安全证书均已启用；正式加密页面和真实人工智能回答通过验收，发布后边缘运行日志未发现应用错误",
        "相同的已验收提交已同步到 GitHub main；Sites v5、GitHub 提交与正式域名共同构成首条经三方核验的发布记录",
      ],
      en: [
        "Migration 0018 adds original bilingual exercises, versioned progress, integer-cent order constraints, a single-use first-payment discount, and direct-introducer rewards backed only by paid platform subscriptions; migrations are repeatable",
        "Seven private-media purposes enforce content signatures, size, ownership, and scope; class covers, voice practice, and chat attachments have authorized reads and retry-safe deletion",
        "The AI gateway unifies public Guru, listening, speaking, writing, and safety review with keyed subject hashes, atomic limits, full-response timeouts, auditing, and fallbacks that never impersonate a human teacher",
        "The Clerk production app, dedicated domain, and SSL are active; signup does not require setting a password, while users may add one later from their account",
        "The first user and four test users completed real Safari sign-in; the first user has no incorrect introducer, test1 has three direct introductions, and every signup reward balance remains zero",
        "Valid referral codes once returned a production 500 because code appended a cookie to immutable Response.redirect() headers; the route now constructs the 302, Location, and secure cookie together and is covered by a real Worker-route regression test",
        "Profile and avatar, private class creation, a public Community topic and reply, direct messages and Guru polish, direct and group Live Chat, an attachment, unread notifications, public Guru, and the signed-in voice entry completed real production-domain acceptance",
        "Chinese and English Home, Classes, Programs, sign-in, Community, Messages, Live Chat, Guru, Project calendar, daily task, and report surfaces completed 110 runtime measurements across all five release viewports with no horizontal overflow, clipping, overlap, meaningful ellipsis, or floating-shortcut collision",
        "The full gate includes every D1 migration, all tests, TypeScript, ESLint, the vinext production build, artifact validation, and client sensitive-data scanning; any failure blocks publishing",
        "Apex and WWW Sites domain, provider, and SSL states are active; production HTTPS pages and a real AI answer passed acceptance, with no application errors after deployment",
        "The same accepted revision is synchronized to GitHub main; Sites v5, the GitHub commit, and the production domain form the first three-way verified release record",
      ],
    },
    rollback: {
      zh: "正式域名已切换到 Sites；如当前构建出现问题，可回退到前一成功 Sites 版本及其对应源提交。真实收费、Stripe Connect、退款、争议与付款 Webhook 仍保持关闭。",
      en: "The production domain now serves Sites; if the current build fails, it can return to the prior successful Sites version and matching source revision. Live charging, Stripe Connect, refunds, disputes, and payment webhooks remain off.",
    },
    next: {
      zh: "推进 8 月 2 日五项：十二语目录、目标与水平引导、可选定位测评、阶段与单元地图、学习路径完整性测试。",
      en: "Continue with the five August 2 tasks: the twelve-language catalog, goal and level onboarding, class-entry placement, the stage and unit map, and learning-path integrity tests.",
    },
  },
  {
    date: "2026-08-02",
    title: {
      zh: "SmartLingo 十二语目录与学习路径日报",
      en: "SmartLingo twelve-language catalog and learning-path report",
    },
    beta: {
      zh: "体验十二语引导与阶段地图",
      en: "Try the twelve-language onboarding and stage map",
    },
    completed: 5,
    summary: {
      zh: "当天恰好完成五项：十二种语言目录、目标与水平引导、入班自适应分级、阶段与单元地图，以及学习路径完整性测试。课程页现在提供十二条清晰、版本化的路径；登录会员可保存目标与起点，且所有定位结果只用于推荐练习，不冒充教师判断或正式证书。",
      en: "Exactly five tasks are complete: the twelve-language catalog, goal and level onboarding, class-entry adaptive placement, the stage and unit map, and learning-path integrity tests. Programs now exposes twelve clear, versioned paths; signed-in members can persist their goals and starting point, and every placement result is only a practice recommendation, never a teacher judgment or official credential.",
    },
    validation: {
      zh: [
        "十二语目录为中文、英语、西班牙语、日语、韩语、法语、德语、俄语、意大利语、葡萄牙语、阿拉伯语和印地语保存稳定编号、本名、文字方向、语音能力、阶段与内容版本；阿拉伯语使用从右向左方向，目录不使用国旗",
        "每条路径由基础、日常和独立三阶段、九个原创双语单元及显式先决关系组成，覆盖词汇、阅读、写作、听力、对话与真实场景；后续阶段明确标为预览，不伪造已完成课程",
        "目标引导收集语言、使用场景、每日五至二十分钟、自报水平与自适应、自选或基础起步方式；认证 API 与 D1 原子批处理持久保存单一有效计划，并在内容升级时保留已有位置",
        "入班定位保留十五题五技能、版本化原创题、服务端评分、暂停与重测，并新增可审计的跳过路径；跳过分数为空，所有结果均显示练习用途与非正式证书说明",
        "0022 D1 迁移加入一百零八个精确注册的十二语路径单元、学习计划表、有效计划唯一约束，以及路径、语言、阶段与单元完全匹配触发器；迁移验证覆盖重复执行、十二语切换、内容升级保位、非法路径、跨语和跨阶段单元拒绝",
        "运行时响应式门槛覆盖中英文十三条代表性路由与 390×844、430×932、834×1112、1194×834、1440×1000 五个视口，共一百三十组；其中六个会员页面由临时本地 D1 真实会话驱动并保留匿名 401 或登录跳转对照，全部满足无横向溢出、满宽内框、自然换行和关键内容不省略",
        "完整门禁通过全部二十三个 D1 迁移、全量一百六十七项测试、TypeScript、ESLint、vinext 生产构建、产物验证和客户端敏感信息扫描；依赖与锁文件未修改",
        "正式域名当前并未列入唯一站点托管项目的自定义域名，因此本次不新增声称站点托管、代码仓库与正式域名三方一致的项目发布记录，也不越权更改域名解析",
      ],
      en: [
        "The catalog stores stable IDs, native names, writing direction, speech capabilities, stages, and content versions for Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi; Arabic is right-to-left and no flags identify languages",
        "Each path has Foundation, Everyday, and Independent stages, nine original bilingual units, and explicit prerequisites spanning vocabulary, reading, writing, listening, dialogue, and real scenarios; later stages are honestly marked as previews rather than fabricated complete courses",
        "Onboarding captures language, use case, a five-to-twenty-minute daily goal, self-reported level, and adaptive, self-selected, or fundamentals entry; an authenticated API and atomic D1 batch persist one active plan while retaining position across content upgrades",
        "Class placement retains fifteen versioned original items across five skills, server scoring, pause, and retake, and adds an auditable skip path; skips have null scores and every outcome carries a practice-only, non-credential disclaimer",
        "D1 migration 0022 adds 108 exactly registered twelve-language path units, learning plans, an active-plan uniqueness constraint, and exact path, language, stage, and unit matching triggers; migration validation covers repeatability, twelve-language switching, version upgrades retaining position, and invalid-path, cross-language, or cross-stage unit rejection",
        "The runtime responsive gate covers thirteen representative routes in Chinese and English at 390×844, 430×932, 834×1112, 1194×834, and 1440×1000, totaling 130 cases; six member pages use a real ephemeral local-D1 session with anonymous 401 or login-redirect controls, and all meet no-overflow, full-inner-width, natural-wrap, and no-meaningful-ellipsis requirements",
        "The complete gate passes all 23 D1 migrations, all 167 tests, TypeScript, ESLint, the vinext production build, artifact validation, and client sensitive-data scanning; dependencies and the lockfile are unchanged",
        "The production domain is not currently listed as a custom domain of the sole Sites project, so this run does not add a Project release record claiming three-way Sites, GitHub, and production-domain parity and does not alter DNS without authority",
      ],
    },
    rollback: {
      zh: "0022 为增量迁移，旧学习进度保持不变；如候选出现问题，可回退 Sites 版本并隐藏新引导入口。真实收费、Stripe Connect、退款、争议与付款 Webhook 继续关闭。",
      en: "Migration 0022 is additive and preserves prior learning progress; if the candidate fails, the Sites version can be rolled back and the new onboarding entry hidden. Live charging, Stripe Connect, refunds, disputes, and payment webhooks remain off.",
    },
    next: {
      zh: "推进 8 月 3 日五项：每日练习编排、即时反馈与讲解、学习经验值与连续学习、中断恢复与跨设备同步、每日学习循环测试。",
      en: "Continue with the five August 3 tasks: daily session composition, instant feedback and explanations, learning XP and streaks, resume and cross-device sync, and daily-loop tests.",
    },
  },
  {
    date: "2026-08-03",
    title: {
      zh: "SmartLingo 每日学习循环日报",
      en: "SmartLingo daily learning loop report",
    },
    beta: {
      zh: "体验五技能编排、反馈与跨设备恢复",
      en: "Try five-skill composition, feedback, and cross-device resume",
    },
    completed: 5,
    summary: {
      zh: "当天恰好完成五项：每日练习编排、即时反馈与讲解、学习经验值与连续学习、中断恢复与跨设备同步，以及每日学习循环测试。学习页现在把会员目标、阶段、近三十日技能证据和到期词汇编成完整六十分钟课程日；每项练习都有可追溯讲解，草稿可以安全恢复，但任何客户端草稿或计时声明都不能伪造完成。",
      en: "Exactly five tasks are complete: daily session composition, instant feedback and explanations, learning XP and streaks, resume and cross-device sync, and daily-loop tests. The learning surface now composes the member goal, stage, recent 30-day skill evidence, and due vocabulary into a complete 60-minute course day; every practice response has traceable explanation, drafts can resume safely, and no client draft or timer claim can fabricate completion.",
    },
    validation: {
      zh: [
        "确定性编排器固定总计六十分钟，始终包含原创新课、到期间隔复习、词汇、阅读、写作、听力、对话和结束回顾；当前弱项获得额外时间，会员五至二十分钟目标作为节奏提示而不是完成证据",
        "普通练习与每日测验均由服务器重建版本化内容后判分；逐题正确性、原创中英文讲解、提示与内容版本在提交后保存和显示，并明确不是真人教师评价或正式、官方考试结果",
        "迁移 0032、0033 与 0034 增量加入课程日检查点、服务端修订快照、带请求指纹的同步操作收据、作答反馈、学习 XP 账本与连续学习状态；不可变课程日范围阻止过期离线草稿污染新课程日，测验五类证据使用单个 D1 事务，失败回滚不遗留半完成回执",
        "学习 XP 只来自成功保存且有服务器分数的学习活动，独立于介绍人奖励与所有班级资金流并明确不具现金价值；连续学习锁定权威 IANA 时区并使用修订号 CAS 对账，每滚动三十天最多修复一个被学习日包围的单日空档",
        "检查点保存不可变课程编排、答案草稿、当前标签与修订号；三方合并的基线只读取服务器历史快照，客户端会话级弱网备份使用操作编号重放，同字段冲突返回 409 并保留本地与服务器两边内容",
        "学习状态 GET 现在只读；课程日完成必须同时满足五技能、每日测验和服务器六十分钟计时，暂停、检查点或客户端零秒都不能提前完成课程",
        "发布门槛执行全部三十六个 D1 迁移、全量二百一十四项测试、TypeScript、ESLint、vinext 生产构建、产物验证和敏感信息扫描；依赖与锁文件未修改",
        "中英文首页、当天新增学习编排与反馈界面、课程、社区、消息与实时聊天、智能导师和项目中心在五个指定视口完成一百七十项运行时布局回归，要求无横向溢出、满宽内框、自然换行、裁切、重叠或关键省略",
        "唯一站点托管项目与代码仓库主分支使用同一候选提交发布；正式域名仍由独立边缘运行服务提供，未列入该站点托管项目，因此本日报不新增三方一致的经核验项目发布记录，也不越权改域名解析、远程仓库或域名路由",
      ],
      en: [
        "The deterministic composer totals exactly 60 minutes and always includes original new material, due spaced review, vocabulary, reading, writing, listening, dialogue, and a recap; the current weak area receives extra time, while the member's 5–20 minute goal is pacing guidance rather than completion evidence",
        "Regular practice and the daily quiz are graded only after the server reconstructs versioned content; per-response correctness, original Chinese and English explanations, hints, and content versions are stored and shown after submission, explicitly neither human-teacher judgment nor a formal or official exam result",
        "Migrations 0032, 0033, and 0034 additively store course-day checkpoints, server revision snapshots, request-fingerprinted sync-operation receipts, answer feedback, the learning-XP ledger, and streak state; immutable course-day scope prevents stale offline drafts from contaminating a new day, and all five quiz evidence classes share one D1 transaction so a failed write rolls back without a poisoned receipt",
        "Learning XP comes only from successfully saved server-scored learning activities, remains separate from introducer rewards and every class-money flow, and has no cash value; streaks lock an authoritative IANA timezone, reconcile with revision CAS, and repair at most one surrounded single-day gap per rolling 30 days",
        "Checkpoints preserve the immutable course composition, answer drafts, active tab, and revision; three-way merge reads its base only from server history, session-scoped weak-network backup replays with operation IDs, and same-field conflicts return 409 while retaining local and server values",
        "Learning-state GET is now read-only; a course day completes only when all five skills, the daily quiz, and the server's 60-minute timer agree, so a pause, checkpoint, or client-reported zero cannot finish it early",
        "The release gate runs all 36 D1 migrations, all 214 tests, TypeScript, ESLint, the vinext production build, artifact validation, and sensitive-data scanning; dependencies and the lockfile remain unchanged",
        "Chinese and English Home, the new learning-composition and feedback surfaces, Classes, Community, Messages and Live Chat, Guru, and Project complete 170 runtime layout cases across all five required viewports, requiring no horizontal overflow, incomplete inner width, unnatural wrapping, clipping, overlap, or meaningful ellipsis",
        "The sole Sites project and GitHub main publish the same candidate commit; the production domain remains on a separate Worker and is not attached to that Sites project, so this report adds no three-way verified Project release and makes no unauthorized DNS, remote, or domain-route change",
      ],
    },
    rollback: {
      zh: "0032、0033 与 0034 只增加学习状态、修订快照和并发控制，不改写旧学习记录；如候选出现问题，可回退 Sites 版本，旧课程活动与词汇进度保持可读。真实收费、Stripe Connect、税务、退款、争议与付款 Webhook 继续关闭。",
      en: "Migrations 0032, 0033, and 0034 add learning state, revision snapshots, and concurrency controls without rewriting prior learning records; if the candidate fails, the Sites version can roll back while prior course activity and vocabulary progress remain readable. Live charging, Stripe Connect, tax, refunds, disputes, and payment webhooks remain off.",
    },
    next: {
      zh: "推进 8 月 4 日五项：版本化词汇记录、多模式词汇卡、间隔复习引擎、错题与重点词本、词汇学习质量测试。",
      en: "Continue with the five August 4 tasks: versioned vocabulary records, multimodal flashcards, the spaced-review engine, mistake and focus lists, and vocabulary-learning quality tests.",
    },
  },
  { date: "2026-08-16", title: { zh: "实时课堂媒体隔离发布 · 2026-08-16 10:33 PDT", en: "Realtime classroom media isolation release · 2026-08-16 10:33 PDT" }, beta: { zh: "查看发布说明", en: "View release notes" }, completed: 4, summary: { zh: "实时课堂候场播放、发布连接与安全保护完成统一。", en: "Realtime classroom waiting playback, publisher connection timing, and safeguards are aligned." }, validation: { zh: ["相关契约测试通过", "生产构建通过"], en: ["Relevant contract tests pass", "Production build passes"] }, rollback: { zh: "可回滚至上一云端运行版本。", en: "Rollback to the previous Cloudflare Worker release." }, next: { zh: "按需在站点专用任务中执行真实用户测试。", en: "Run real-user testing in the dedicated site task when requested." } },
  {
    date: "2026-08-21",
    title: {
      zh: "21 天真实学习验收第 1 天 · 语音输入受阻",
      en: "21-day real-learning acceptance, day 1 · speech input blocked",
    },
    beta: {
      zh: "查看四语真实学习证据与受阻项",
      en: "Review four-language real-learning evidence and blockers",
    },
    completed: 24,
    summary: {
      zh: "匿名测试学习者 qa_test_learner_1 在正式站中文界面完成英语、日语、西班牙语和意大利语的课程五技能、SmartCard 与生活口语导航验收。四语均超过当天计划的有效学习分钟并显示持久化服务器测验 100/100；生活口语能播放短语、保持目标语言与推进幻灯片，但 Chrome 自动化无法提供真实麦克风语音，因此四语语音评分均标记为受阻，本日不判定为全量通过。",
      en: "The anonymized learner qa_test_learner_1 used the production Chinese interface for English, Japanese, Spanish, and Italian Course five-skill, SmartCard, and Everyday Speaking navigation acceptance. Every language exceeded its planned active-learning minutes and displayed a persisted 100/100 server quiz score. Everyday Speaking played phrases, preserved the target language, and advanced slides, but Chrome automation could not supply real microphone speech, so speech scoring is blocked for all four languages and the day is not reported as a full pass.",
    },
    validation: {
      zh: [
        "正式地址：https://smartlingo.net；界面语言为中文；登录页可见身份与匿名测试键一致；浏览器控制台未发现错误或警告",
        "英语：计划 1 分钟，学习日志计量 7 分钟，深度技能为口语；课程五技能、SmartCard 作答与生活口语播放/导航完成；测验 100/100 且刷新后仍显示；真实麦克风评分受阻",
        "日语：计划 5 分钟，学习日志计量 20 分钟，深度技能为写作；额外检查两道逐词组句题，均显示错误反馈并推进题号；课程、SmartCard 与生活口语完成；测验 100/100 且学习日志可见；真实麦克风评分受阻",
        "西班牙语：计划 2 分钟，学习日志计量 20 分钟，深度技能为词汇；课程、额外词汇反馈、SmartCard 与生活口语完成；写作和听力均显示错误反馈并由 1/10 推进到 2/10；测验 100/100 且学习日志可见；真实麦克风评分受阻",
        "意大利语：计划 5 分钟，学习日志计量 21 分钟，深度技能为词汇；课程、额外词汇反馈、SmartCard 与生活口语完成；写作和听力均显示错误反馈并由 1/10 推进到 2/10；测验 100/100 且学习日志可见；真实麦克风评分受阻",
        "句子合同通过：36 门正式课程每门恰有 120 句，Listening 与 Writing 每日各有 10 道唯一题；当天 GitHub route preflight 16/16 路由成功，且仅作为匿名路由证据",
        "未进入支付、推荐、证书、挑战或排行榜流程；SmartCard 只完成单题，页面积分为未完成整轮前的临时分，不触发领取；在只使用指定学习者的约束下无法执行管理员数据库级账本复核，因此账本复核保持受阻而非声称通过",
      ],
      en: [
        "Production URL: https://smartlingo.net; interface language was Chinese; the visible signed-in identity matched the anonymized test key; no browser console errors or warnings were observed",
        "English: 1 minute planned, 7 learning-log minutes measured, speaking deep focus; five Course skills, a SmartCard answer, and Everyday Speaking playback/navigation completed; quiz remained 100/100 after refresh; real microphone scoring blocked",
        "Japanese: 5 minutes planned, 20 learning-log minutes measured, writing deep focus; two extra word-order questions showed incorrect feedback and advanced the counter; Course, SmartCard, and Everyday Speaking completed; quiz 100/100 and learning log visible; real microphone scoring blocked",
        "Spanish: 2 minutes planned, 20 learning-log minutes measured, vocabulary deep focus; Course, extra vocabulary feedback, SmartCard, and Everyday Speaking completed; Writing and Listening both showed incorrect feedback and advanced from 1/10 to 2/10; quiz 100/100 and learning log visible; real microphone scoring blocked",
        "Italian: 5 minutes planned, 21 learning-log minutes measured, vocabulary deep focus; Course, extra vocabulary feedback, SmartCard, and Everyday Speaking completed; Writing and Listening both showed incorrect feedback and advanced from 1/10 to 2/10; quiz 100/100 and learning log visible; real microphone scoring blocked",
        "Sentence contracts passed: all 36 official courses expose exactly 120 sentences, with ten unique daily Listening and Writing items; the day's GitHub route preflight passed 16/16 routes and was treated only as anonymous route evidence",
        "No payment, referral, certificate, challenge, or leaderboard flow was entered; only one SmartCard item was completed, so its displayed points remained provisional before a full-round claim. Admin-level database ledger verification was unavailable under the exactly-one-test-learner constraint and is therefore blocked rather than reported as passed",
      ],
    },
    rollback: {
      zh: "本记录只发布真实验收证据，不改变课程、评分、身份、商业或学习数据；如报告展示异常，可回滚到上一成功边缘运行提交。",
      en: "This record publishes real acceptance evidence only and changes no course, scoring, identity, commerce, or learner data; roll back to the previous successful Worker commit if report rendering regresses.",
    },
    next: {
      zh: "恢复可提供真实语音输入的 Chrome 麦克风能力后重试四语生活口语评分，并由授权管理员只读复核测试学习者的支付、推荐、证书、课程积分、挑战奖励与排行榜账本。",
      en: "Retry four-language Everyday Speaking scoring when Chrome can provide real microphone input, then have an authorized administrator read-only verify the learner's payment, referral, certificate, course-credit, challenge-reward, and leaderboard ledgers.",
    },
  },
  {
    date: "2026-08-22",
    title: {
      zh: "21 天真实学习验收第 2 天 · 语音与积分账本受阻",
      en: "21-day real-learning acceptance, day 2 · speech and credit-ledger blockers",
    },
    beta: {
      zh: "查看四语课程、游戏与生活口语证据",
      en: "Review four-language Course, Play, and Everyday evidence",
    },
    completed: 32,
    summary: {
      zh: "匿名测试学习者 qa-525acd3a 在正式站中文界面完成英语、日语、西班牙语和意大利语的课程五技能、五技能今日速成、十二张智慧卡练习与生活口语验收。四语均超过当天计划的实测有效学习分钟，服务器测验均为 100/100，8 月 22 日五技能日志均已持久化。真实语音输入不可用，且完整智慧卡练习产生了课程积分，违反本次验收的零课程积分账本条件，因此本日不判定为全量通过。",
      en: "The anonymized learner qa-525acd3a completed all five Course skills, a five-skill Today's Sprint, all twelve SmartCard Practice items, and Everyday Speaking for English, Japanese, Spanish, and Italian on the production Chinese interface. Every language exceeded its measured active-learning target, each server quiz scored 100/100, and all five skill logs persisted on August 22. Real speech input was unavailable, and completing SmartCard Practice created course credit, violating this acceptance run's zero-course-credit-ledger condition, so the day is not reported as a full pass.",
    },
    validation: {
      zh: [
        "正式地址为 https://smartlingo.net；太平洋日期 2026-08-22；匿名测试键 qa-525acd3a；当天 GitHub 路由预检 16/16 成功，且仅作为匿名路由证据",
        "英语：计划 4 分钟，实测有效学习 7.496 分钟，深度技能为词汇；课程五技能完成，今日练习分 97/100，服务器测验 100/100；8 月 22 日日志为词汇 2 次/6 分钟、阅读 1/2、写作 1/3、听力 1/2、对话 1/2；今日速成 80/100，智慧卡 12/12 完成，生活口语播放与麦克风入口可见",
        "日语：计划 4 分钟，实测有效学习 5.297 分钟，深度技能为听力；课程五技能完成，今日练习分 92/100，服务器测验 100/100；8 月 22 日日志为词汇 2 次/4 分钟、阅读 1/2、写作 1/3、听力 1/2、对话 1/2；今日速成 80/100，智慧卡 12/12 完成，生活口语保持日语并推进幻灯片",
        "西班牙语：计划 3 分钟，实测有效学习 3.689 分钟，深度技能为阅读；课程五技能完成，今日练习分 90/100，服务器测验 100/100；8 月 22 日日志为词汇 2 次/4 分钟、阅读 1/2、写作 1/3、听力 1/2、对话 1/2；今日速成 80/100，智慧卡 12/12 完成，生活口语保持西班牙语",
        "意大利语：计划 3 分钟，实测有效学习 3.365 分钟，深度技能为阅读；课程五技能完成，今日练习分 88/100，服务器测验 100/100；8 月 22 日日志为词汇 2 次/4 分钟、阅读 1/2、写作 1/3、听力 1/2、对话 1/2；今日速成 80/100，智慧卡 12/12 完成，生活口语保持意大利语",
        "四语今日速成都完成词汇、阅读、听力、写作和口语步骤；无真实麦克风语音输入时口语为 0，最终均显示 80/100。语音入口和设备聆听状态可见，但不能产生真实语音评分，因此语音验收标记为受阻而不是通过",
        "完整测试发现并修复三个跨午夜缺陷：当天练习错误沿用旧检查点日期、旧日期测验答案污染当天请求、测验回执混用练习与检查点的日期及内容版本。最终修复提交 740971b4310e4f0f21f4909ff4935baea86fce07，Cloudflare 部署 32568803861 成功；全量构建与 335 项测试通过",
        "未进入支付、推荐、证书、挑战或排行榜流程；但四语完整智慧卡练习显示课程积分已保存或达到当日领取上限，无法确认零课程积分账本。任务禁止直接编辑学习或积分记录，因此该条件保持失败；管理员数据库级只读复核也保持受阻",
      ],
      en: [
        "Production URL: https://smartlingo.net; Pacific date: 2026-08-22; anonymized learner key: qa-525acd3a; the day's GitHub route preflight passed 16/16 and was treated only as anonymous route evidence",
        "English: 4 minutes planned, 7.496 measured active minutes, vocabulary deep focus; all five Course skills completed, today's practice score 97/100, server quiz 100/100; the August 22 log shows vocabulary 2/6 minutes, reading 1/2, writing 1/3, listening 1/2, and dialogue 1/2; Today's Sprint 80/100, SmartCard 12/12, and Everyday playback plus microphone entry visible",
        "Japanese: 4 minutes planned, 5.297 measured active minutes, listening deep focus; all five Course skills completed, today's practice score 92/100, server quiz 100/100; the August 22 log shows vocabulary 2/4 minutes, reading 1/2, writing 1/3, listening 1/2, and dialogue 1/2; Today's Sprint 80/100, SmartCard 12/12, and Everyday retained Japanese while advancing slides",
        "Spanish: 3 minutes planned, 3.689 measured active minutes, reading deep focus; all five Course skills completed, today's practice score 90/100, server quiz 100/100; the August 22 log shows vocabulary 2/4 minutes, reading 1/2, writing 1/3, listening 1/2, and dialogue 1/2; Today's Sprint 80/100, SmartCard 12/12, and Everyday retained Spanish",
        "Italian: 3 minutes planned, 3.365 measured active minutes, reading deep focus; all five Course skills completed, today's practice score 88/100, server quiz 100/100; the August 22 log shows vocabulary 2/4 minutes, reading 1/2, writing 1/3, listening 1/2, and dialogue 1/2; Today's Sprint 80/100, SmartCard 12/12, and Everyday retained Italian",
        "Every Today's Sprint completed vocabulary, reading, listening, writing, and speaking; without real microphone speech, speaking scored 0 and every final score was 80/100. The speech entry and device-listening state were visible, but no real speech score could be produced, so speech acceptance is blocked rather than passed",
        "The run found and fixed three cross-midnight defects: current practice inherited the old checkpoint date, prior-date quiz answers polluted current requests, and quiz receipts conflated practice and checkpoint dates and content versions. Final fix commit 740971b4310e4f0f21f4909ff4935baea86fce07 deployed successfully in Cloudflare run 32568803861; the full build and all 335 tests passed",
        "No payment, referral, certificate, challenge, or leaderboard flow was entered; however, completing all four SmartCard practices displayed saved course credit or the daily claim cap, so a zero course-credit ledger cannot be confirmed. The task forbids direct learning or credit record edits, leaving that condition failed; administrator-level read-only ledger verification is also blocked",
      ],
    },
    rollback: {
      zh: "本报告只增加真实验收证据。学习与测验修复可回滚至上一成功边缘运行版本，但已持久化的合法学习活动与积分记录不得由本任务直接改写。",
      en: "This report adds only real acceptance evidence. The learning and quiz fixes can roll back to the previous successful Worker, but this task must not directly rewrite persisted legitimate learning activity or credit records.",
    },
    next: {
      zh: "在可提供真实语音输入的 Chrome 环境重试四语口语评分；由授权管理员只读复核测试学习者的支付、推荐、证书、课程积分、挑战奖励与排行榜账本，并决定是否为自动化验收账户禁用可抵扣积分领取。",
      en: "Retry four-language speech scoring in Chrome with real audio input; have an authorized administrator read-only verify payment, referral, certificate, course-credit, challenge-reward, and leaderboard ledgers, then decide whether redeemable credit claims should be disabled for automated acceptance accounts.",
    },
  },
  {
    date: "2026-08-24",
    title: {
      zh: "21 天真实学习验收第 4 天 · 麦克风输入受阻",
      en: "21-day real-learning acceptance, day 4 · microphone input blocked",
    },
    beta: {
      zh: "查看听力修复与未完成验收证据",
      en: "Review the Listening fix and incomplete acceptance evidence",
    },
    completed: 4,
    summary: {
      zh: "匿名测试学习者 qa_test_learner_1 在正式站中文界面复现并验证英语课程听力词块方向缺陷。修复后，听力隐藏英语原句、提供英语词块、显示正确反馈并将题号从 1/10 推进到 2/10；英语词汇与阅读日志已持久化。Chrome 语音识别能进入聆听状态，但自动化环境没有可用人声输入，约十秒后无转写、无评分结束，因此当天四语完整验收停止并标记为受阻，不判定为通过。",
      en: "The anonymized learner qa_test_learner_1 reproduced and verified the English Course Listening tile-direction defect on the production Chinese interface. After the fix, Listening hid the English sentence, offered English tiles, showed correct feedback, and advanced from 1/10 to 2/10; English vocabulary and reading logs persisted. Chrome speech recognition entered its listening state but the automation environment had no usable human voice input, ending after about ten seconds without a transcript or score. The complete four-language acceptance therefore stopped as blocked and is not reported as a pass.",
    },
    validation: {
      zh: [
        "正式地址：https://smartlingo.net；太平洋日期 2026-08-24；匿名测试键 qa_test_learner_1；中文界面与可见账户身份已核对；浏览器控制台错误为 0",
        "句子合同通过：36 门正式课程每门 120 句，Listening 与 Writing 每日各 10 道唯一题；GitHub route preflight 32714614636 的 16/16 匿名路由检查成功，且未作为登录或学习证据",
        "英语：计划 2 分钟，深度技能为口语；词汇反馈已保存，阅读 100/100 已保存，写作正确反馈并从 1/10 到 2/10；听力修复后以英语原句方向正确作答并从 1/10 到 2/10；8 月 24 日日志显示词汇 1 次/1 分钟、阅读 1 次/2 分钟",
        "英语有效学习分钟未形成排除诊断与部署时间的完整连续测量，因此不声称达到 2 分钟最低值；考试、今日速成、智慧卡与生活口语未完成，没有可报告的当日服务器测验或 Sprint 最终分数",
        "日语计划 2 分钟/听力重点、西班牙语计划 2 分钟/口语重点、意大利语计划 5 分钟/写作重点；三语均因同一真实语音输入依赖未开始，实测有效学习为 0 分钟，课程、Play、生活口语、分数与持久日志均未通过",
        "缺陷修复提交 02f01ce2b2b944ba4d0aa8550f4ad1a07e234694，边缘部署 32715899537 成功；352/352 测试、62 个 D1 迁移、类型检查、生产构建、敏感信息与边缘运行产物检查、260/260 WebKit 布局及共享站点门禁通过",
        "未进入支付、推荐、证书、课程积分、挑战奖励或排行榜流程；测试学习者无管理员账本权限，因此零账本复核保持受阻而不是声称通过",
      ],
      en: [
        "Production URL: https://smartlingo.net; Pacific date: 2026-08-24; anonymized learner key: qa_test_learner_1; Chinese interface and visible account identity verified; browser console errors: 0",
        "Sentence contracts passed: all 36 official courses expose 120 sentences, with ten unique daily Listening and Writing items; GitHub route preflight 32714614636 passed 16/16 anonymous route checks and was not treated as login or learning evidence",
        "English: 2 minutes planned, speaking deep focus; vocabulary feedback persisted, Reading 100/100 persisted, Writing showed correct feedback and advanced 1/10 to 2/10; fixed Listening rebuilt the hidden English sentence correctly and advanced 1/10 to 2/10; the August 24 log shows vocabulary 1 time/1 minute and reading 1 time/2 minutes",
        "English active-learning time was not captured as one complete measurement excluding diagnosis and deployment, so the two-minute minimum is not claimed; Exam, Today's Sprint, SmartCard, and Everyday Speaking were incomplete, with no current-day server quiz or Sprint final score to report",
        "Japanese planned 2 minutes/listening focus, Spanish planned 2 minutes/speaking focus, and Italian planned 5 minutes/writing focus; all three were not started after the shared real-voice-input dependency failed, with 0 measured active minutes and no passing Course, Play, Everyday, score, or persisted-log evidence",
        "Defect fix commit 02f01ce2b2b944ba4d0aa8550f4ad1a07e234694 deployed successfully in Cloudflare run 32715899537; 352/352 tests, 62 D1 migrations, TypeScript, production build, sensitive-data and Worker-artifact checks, 260/260 WebKit layout cases, and shared-site gates passed",
        "No payment, referral, certificate, course-credit, challenge-reward, or leaderboard flow was entered; the learner lacks administrator ledger access, so zero-ledger verification remains blocked rather than reported as passed",
      ],
    },
    rollback: {
      zh: "本报告只增加非私密验收证据；如报告展示异常，可回滚报告提交。听力修复可回滚到上一成功边缘运行版本，但不得改写已持久化的合法学习记录。",
      en: "This report adds only non-secret acceptance evidence and can be rolled back if its presentation regresses. The Listening fix can roll back to the prior successful Worker, but legitimate persisted learning records must not be rewritten.",
    },
    next: {
      zh: "恢复可提供真实人声输入的 Chrome 麦克风环境后，从英语口语同一步骤重试，再完成四语 Course、Play、生活口语、计划时长、服务器分数与管理员只读账本复核。",
      en: "When Chrome has real human voice input, retry from the same English speaking step, then complete all four languages' Course, Play, Everyday Speaking, planned durations, server scores, and administrator read-only ledger verification.",
    },
  },
];

export const taskById = (id: string) => projectTasks.find(task => task.id === id);
export const tasksByDate = (date: string) => projectTasks.filter(task => task.date === date);
export const reportByDate = (date: string) => projectReports.find(report => report.date === date);
