export const SMARTLINGO_LEARNING_DAYS = 21 as const;
export const SMARTLINGO_LEARNING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type SmartLingoLearningLevel = (typeof SMARTLINGO_LEARNING_LEVELS)[number];
export type SmartLingoRewardFeature = "sprint" | "smartcard_practice" | "smartcard_challenge" | "course";

type Database = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; run<T = unknown>(): Promise<{ results?: T[]; success?: boolean }> } } };

const BEGINNER_TOPICS = [
  ["Greetings and names", "问候与姓名"], ["Numbers and time", "数字与时间"], ["Family and people", "家人与人物"],
  ["Food and drink", "食物与饮品"], ["Home and rooms", "家庭与房间"], ["Daily routines", "日常作息"],
  ["Places nearby", "附近地点"], ["Directions", "问路与方向"], ["Shopping basics", "基础购物"],
  ["Weather and clothes", "天气与衣物"], ["Transport", "交通出行"], ["Health and help", "健康与求助"],
  ["Work and study", "工作与学习"], ["Likes and choices", "喜好与选择"], ["Plans and dates", "计划与日期"],
  ["Past activities", "过去的活动"], ["Requests and permission", "请求与许可"], ["Comparisons", "简单比较"],
  ["Problems and solutions", "问题与解决"], ["Connected conversation", "连贯会话"], ["Everyday mission", "生活任务综合"],
] as const;

const INTERMEDIATE_TOPICS = [
  ["Natural introductions", "自然介绍"], ["Clarifying details", "澄清细节"], ["Describing relationships", "描述关系"],
  ["Ordering and preferences", "点单与偏好"], ["Housing decisions", "居住选择"], ["Habits and change", "习惯与改变"],
  ["Explaining locations", "解释位置"], ["Route changes", "路线变化"], ["Comparing products", "比较商品"],
  ["Advice for conditions", "情境建议"], ["Travel disruptions", "行程变化"], ["Symptoms and advice", "症状与建议"],
  ["Projects and learning", "项目与学习"], ["Giving reasons", "说明理由"], ["Arranging plans", "安排计划"],
  ["Telling a short story", "讲述短故事"], ["Polite negotiation", "礼貌协商"], ["Trade-offs", "权衡比较"],
  ["Resolving a service issue", "解决服务问题"], ["Sustained conversation", "持续会话"], ["Independent real-life task", "独立生活任务"],
] as const;

const ADVANCED_TOPICS = [
  ["Register and identity", "语域与身份"], ["Precision and nuance", "精确与细微差别"], ["Social perspectives", "社会视角"],
  ["Taste and cultural context", "品味与文化语境"], ["Housing and community", "居住与社区"], ["Changing behaviour", "行为改变"],
  ["Spatial explanation", "空间解释"], ["Complex navigation", "复杂路线"], ["Value and persuasion", "价值与说服"],
  ["Conditions and consequences", "条件与后果"], ["Travel problem-solving", "旅行问题解决"], ["Detailed health communication", "详细健康沟通"],
  ["Professional collaboration", "专业协作"], ["Evidence and opinion", "证据与观点"], ["Contingency planning", "应变计划"],
  ["Narrative and reflection", "叙事与反思"], ["Diplomatic negotiation", "策略性协商"], ["Evaluating alternatives", "评估方案"],
  ["Conflict resolution", "冲突解决"], ["Extended spontaneous dialogue", "即兴长对话"], ["Real-world capstone", "真实任务综合"],
] as const;

export function safeLearningDay(value: unknown, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(1, Math.min(SMARTLINGO_LEARNING_DAYS, number)) : fallback;
}

export function safeLearningLevel(value: unknown): SmartLingoLearningLevel {
  return value === "intermediate" || value === "advanced" ? value : "beginner";
}

export function learningDayTopic(level: SmartLingoLearningLevel, day: number) {
  const topics = level === "advanced" ? ADVANCED_TOPICS : level === "intermediate" ? INTERMEDIATE_TOPICS : BEGINNER_TOPICS;
  const [en, zh] = topics[safeLearningDay(day) - 1];
  return { en, zh };
}

export async function learningReward(database: Database, feature: SmartLingoRewardFeature, level: SmartLingoLearningLevel, score: number) {
  const rule = await database.prepare(`SELECT reward_points AS rewardPoints FROM smartlingo_learning_reward_rules
    WHERE feature=? AND level=? AND status='active' AND minimum_score<=? ORDER BY minimum_score DESC LIMIT 1`)
    .bind(feature, level, Math.max(0, Math.min(100, Math.round(score)))).first<{ rewardPoints: number }>();
  return Math.max(0, Number(rule?.rewardPoints || 0));
}

export async function nextLearningDay(database: Database, userId: string, feature: SmartLingoRewardFeature, level: SmartLingoLearningLevel, targetLanguage: string, classId?: string | null) {
  const rows = await database.prepare(`SELECT DISTINCT day_number AS dayNumber FROM smartlingo_learning_score_history
    WHERE user_id=? AND feature=? AND level=? AND target_language=? AND (? IS NULL OR class_id=?) AND score>=60 ORDER BY day_number`)
    .bind(userId, feature, level, targetLanguage, classId || null, classId || null).run<{ dayNumber: number }>();
  const completed = new Set((rows.results || []).map(row => Number(row.dayNumber)));
  for (let day = 1; day <= SMARTLINGO_LEARNING_DAYS; day += 1) if (!completed.has(day)) return day;
  return SMARTLINGO_LEARNING_DAYS;
}
