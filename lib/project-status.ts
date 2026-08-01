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
  editionDate: "2026-07-31",
  today: 5,
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
];

export const taskById = (id: string) => projectTasks.find(task => task.id === id);
export const tasksByDate = (date: string) => projectTasks.filter(task => task.date === date);
export const reportByDate = (date: string) => projectReports.find(report => report.date === date);
