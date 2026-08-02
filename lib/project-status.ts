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
  editionDate: "2026-08-02",
  today: 15,
  total: 100,
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
        "0022 D1 迁移加入学习计划表、有效计划唯一约束、已发布路径和语言匹配触发器；迁移验证覆盖重复执行、十二语切换、内容升级保位、非法路径与跨语单元拒绝",
        "运行时响应式门槛覆盖中英文十三条代表性路由与 390×844、430×932、834×1112、1194×834、1440×1000 五个视口，共一百三十组；全部满足无横向溢出、满宽内框、自然换行和关键内容不省略",
        "完整门禁通过全部二十三个 D1 迁移、全量一百六十六项测试、TypeScript、ESLint、vinext 生产构建、产物验证和客户端敏感信息扫描；依赖与锁文件未修改",
        "正式域名当前并未列入唯一站点托管项目的自定义域名，因此本次不新增声称站点托管、代码仓库与正式域名三方一致的项目发布记录，也不越权更改域名解析",
      ],
      en: [
        "The catalog stores stable IDs, native names, writing direction, speech capabilities, stages, and content versions for Chinese, English, Spanish, Japanese, Korean, French, German, Russian, Italian, Portuguese, Arabic, and Hindi; Arabic is right-to-left and no flags identify languages",
        "Each path has Foundation, Everyday, and Independent stages, nine original bilingual units, and explicit prerequisites spanning vocabulary, reading, writing, listening, dialogue, and real scenarios; later stages are honestly marked as previews rather than fabricated complete courses",
        "Onboarding captures language, use case, a five-to-twenty-minute daily goal, self-reported level, and adaptive, self-selected, or fundamentals entry; an authenticated API and atomic D1 batch persist one active plan while retaining position across content upgrades",
        "Class placement retains fifteen versioned original items across five skills, server scoring, pause, and retake, and adds an auditable skip path; skips have null scores and every outcome carries a practice-only, non-credential disclaimer",
        "D1 migration 0022 adds learning plans, an active-plan uniqueness constraint, and published-path and matching-language triggers; migration validation covers repeatability, twelve-language switching, version upgrades retaining position, and invalid-path or cross-language-unit rejection",
        "The runtime responsive gate covers thirteen representative routes in Chinese and English at 390×844, 430×932, 834×1112, 1194×834, and 1440×1000, totaling 130 cases; all meet no-overflow, full-inner-width, natural-wrap, and no-meaningful-ellipsis requirements",
        "The complete gate passes all 23 D1 migrations, all 166 tests, TypeScript, ESLint, the vinext production build, artifact validation, and client sensitive-data scanning; dependencies and the lockfile are unchanged",
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
];

export const taskById = (id: string) => projectTasks.find(task => task.id === id);
export const tasksByDate = (date: string) => projectTasks.filter(task => task.date === date);
export const reportByDate = (date: string) => projectReports.find(report => report.date === date);
