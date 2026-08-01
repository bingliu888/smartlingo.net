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
  today: 9,
  total: 100,
};

// A release appears here only after the same revision has verifiable Sites,
// GitHub, and production-domain evidence. The migration foundation is local,
// so the truthful initial state contains no release record.
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
      zh: "查看四项完成与一项阻塞证据",
      en: "Review four completions and one blocker",
    },
    completed: 4,
    summary: {
      zh: "当天恰好处理五项：D1 核心模型、R2 私有媒体、统一人工智能网关与基础设施隔离测试已有代码和验证证据；Clerk 邮箱验证码与会话桥接已在本地完成，但正式域名仍提供旧站、Sites 生产环境未配置 Clerk，真实邮件、CAPTCHA、Safari 会话与 Cookie 桥接无法验收，因此该项保持受阻而不伪造完成。",
      en: "Exactly five tasks were handled: the D1 core model, private R2 media, unified AI gateway, and infrastructure-isolation tests have code and validation evidence. Clerk email codes and the session bridge are locally complete, but the production domain still serves the legacy site and Sites has no Clerk production configuration, so real email, CAPTCHA, Safari-session, and cookie-bridge acceptance is blocked and the task is not falsely marked complete.",
    },
    validation: {
      zh: [
        "0018 迁移加入原创双语练习、版本化进度、整分订单约束、首次支付单次优惠和只由已付款平台订阅支持的直接介绍人积分关系；迁移可重复执行",
        "七类私有媒体执行内容签名、大小、所有权与范围约束；班级封面、语音练习和聊天附件具备授权读取与可重试删除",
        "人工智能网关统一公开导师、听说写反馈和安全审核，使用键控主体哈希、原子限流、完整响应体超时、审计与不冒充真人教师的回退",
        "Clerk 行为测试覆盖未知邮箱无密码注册、验证码、缺失要求、二次验证、CAPTCHA 挂载和严格会话桥接，但生产外部配置验收仍受阻",
        "首次 Sites 生产验收发现身份代理在缺少 Clerk 配置时错误阻断公开班级与登录外壳；共享根因已修为公开外壳继续渲染、受保护页面由路由安全跳转，而身份写入仍由服务端失败关闭",
        "中英文首页、班级、课程、登录、社区、消息、群组实时聊天、智能导师、项目日历、当日任务与日报已在五个发布视口完成 110 项运行时测量；无横向溢出、裁切、重叠、关键省略或悬浮入口遮挡",
        "完整门禁包括全部 D1 迁移、全量测试、TypeScript、ESLint、vinext 生产构建、产物验证与客户端敏感信息扫描；任一失败均阻止发布",
        "正式域名未通过 Sites 自定义域验收，因此项目发布历史不登记经核验版本；Sites 版本、GitHub 提交与域名结果以本次自动化报告为准",
      ],
      en: [
        "Migration 0018 adds original bilingual exercises, versioned progress, integer-cent order constraints, a single-use first-payment discount, and direct-introducer rewards backed only by paid platform subscriptions; migrations are repeatable",
        "Seven private-media purposes enforce content signatures, size, ownership, and scope; class covers, voice practice, and chat attachments have authorized reads and retry-safe deletion",
        "The AI gateway unifies public Guru, listening, speaking, writing, and safety review with keyed subject hashes, atomic limits, full-response timeouts, auditing, and fallbacks that never impersonate a human teacher",
        "Clerk behavior tests cover passwordless unknown-email registration, codes, missing requirements, second factors, the CAPTCHA mount, and a strict session bridge, while production external-configuration acceptance remains blocked",
        "The first Sites production acceptance found that the identity proxy incorrectly blocked public class and sign-in shells when Clerk was unconfigured; the shared fix preserves those shells and route-level protected redirects while server-side identity writes still fail closed",
        "Chinese and English Home, Classes, Programs, sign-in, Community, Messages, Live Chat, Guru, Project calendar, daily task, and report surfaces completed 110 runtime measurements across all five release viewports with no horizontal overflow, clipping, overlap, meaningful ellipsis, or floating-shortcut collision",
        "The full gate includes every D1 migration, all tests, TypeScript, ESLint, the vinext production build, artifact validation, and client sensitive-data scanning; any failure blocks publishing",
        "The production domain has not passed Sites custom-domain acceptance, so Project release history records no verified release; the Sites version, GitHub commit, and domain result are reported by this automation run",
      ],
    },
    rollback: {
      zh: "正式域名尚未切换到 Sites，旧站流量未被本次改动替换；如新 Sites 构建出现问题，可回退到既有 Sites v1 与其对应源提交。真实收费、连接账户、退款、争议与 Webhook 仍保持关闭。",
      en: "The production domain has not cut over to Sites, so this change has not replaced legacy-site traffic. If the new Sites build fails, it can return to the existing Sites v1 and its matching source revision. Live charging, connected accounts, refunds, disputes, and webhooks remain off.",
    },
    next: {
      zh: "先重试最早受阻的 Clerk 正式环境验收；解除后推进 8 月 2 日五项：七语目录、目标与水平引导、可选定位测评、阶段与单元地图、学习路径完整性测试。",
      en: "First retry the earliest blocked Clerk production acceptance; once cleared, continue the five August 2 tasks: the seven-language catalog, goal and level onboarding, optional placement checks, the stage and unit map, and learning-path integrity tests.",
    },
  },
];

export const taskById = (id: string) => projectTasks.find(task => task.id === id);
export const tasksByDate = (date: string) => projectTasks.filter(task => task.date === date);
export const reportByDate = (date: string) => projectReports.find(report => report.date === date);
