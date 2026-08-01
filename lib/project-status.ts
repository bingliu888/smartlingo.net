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
  editionDate: "2026-08-01",
  today: 10,
  total: 100,
};

// A release appears here only after the same revision has verifiable Sites,
// GitHub, and production-domain evidence. Sites and the formal domain are
// live, but GitHub is still empty, so there is no fabricated release record.
export const projectBuilds: ProjectBuild[] = [];

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
        "GitHub 空仓库仍等待账户的受保护操作确认，因此在相同提交同步 GitHub main 前，项目发布历史不会伪造经三方核验的版本记录",
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
        "The empty GitHub repository still awaits the account's protected-action confirmation, so Project release history does not fabricate a three-way verified version before the same commit reaches GitHub main",
      ],
    },
    rollback: {
      zh: "正式域名已切换到 Sites；如当前构建出现问题，可回退到前一成功 Sites 版本及其对应源提交。真实收费、Stripe Connect、退款、争议与付款 Webhook 仍保持关闭。",
      en: "The production domain now serves Sites; if the current build fails, it can return to the prior successful Sites version and matching source revision. Live charging, Stripe Connect, refunds, disputes, and payment webhooks remain off.",
    },
    next: {
      zh: "完成 GitHub 受保护操作确认后，将同一验证提交同步到 main 并登记经三方核验的发布记录；随后推进 8 月 2 日五项：七语目录、目标与水平引导、可选定位测评、阶段与单元地图、学习路径完整性测试。",
      en: "After the protected GitHub action is confirmed, synchronize the same validated commit to main and record the three-way verified release; then continue the five August 2 tasks: the seven-language catalog, goal and level onboarding, optional placement checks, the stage and unit map, and learning-path integrity tests.",
    },
  },
];

export const taskById = (id: string) => projectTasks.find(task => task.id === id);
export const tasksByDate = (date: string) => projectTasks.filter(task => task.date === date);
export const reportByDate = (date: string) => projectReports.find(report => report.date === date);
