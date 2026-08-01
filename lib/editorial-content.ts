import { getDatabase } from "./auth";

export type EditorialCard = { label: string; title: string; body: string; date?: string; source?: string; url?: string; status?: string; location?: string };
export type EditorialDocument = { editionDate: string; zh: EditorialCard[]; en: EditorialCard[] };

export const fallbackNews: EditorialDocument = {
  editionDate: "2026-07-31",
  en: [
    { label: "Platform · Foundation", date: "2026-07-31", title: "SmartLingo preserves its seven-language starting point", body: "Spanish, English, French, Japanese, German, Italian, and Korean remain the first catalog while the platform adds complete listening, speaking, reading, and writing practice." },
    { label: "Classes · Member-led", date: "2026-07-31", title: "Every signed-in member can prepare a private language class", body: "A member may act as teacher or coordinator, choose an approved path, invite learners, set a schedule and operate a focused class Community." },
    { label: "Commerce · Clear rules", date: "2026-07-31", title: "Class economics and introducer rewards are kept separate", body: "The planned class checkout applies a one-time 15% first-payment discount and splits the discounted pre-tax amount 70% to the owner and 30% to the platform. Class orders never create introducer points." },
  ],
  zh: [
    { label: "平台 · 基础建设", date: "2026-07-31", title: "SmartLingo 保留七种语言的原始起点", body: "西班牙语、英语、法语、日语、德语、意大利语和韩语继续作为首批目录，并逐步加入完整的听说读写训练。" },
    { label: "班级 · 会员共建", date: "2026-07-31", title: "每位登录会员都可以准备自己的私有语言班", body: "会员可担任老师或协调员，选择经批准的学习路径、邀请学员、设置日程，并运营专属班级社区。" },
    { label: "商务 · 规则透明", date: "2026-07-31", title: "班级分账与介绍人积分严格分开", body: "计划中的班级结账为首次付款提供一次八五折，并按折后税前金额向班主分配七成、平台分配三成；班级订单一律不产生介绍人积分。" },
  ],
};

export const fallbackEvents: EditorialDocument = {
  editionDate: "2026-07-31",
  en: [
    { label: "Language-path orientation", status: "Planned", location: "Online · bilingual", date: "2026", title: "Choose a language and complete the first daily loop", body: "A guided introduction to placement, compact lessons, vocabulary review, four-skill practice, the AI Guru, and safe social learning." },
    { label: "Class coordinator workshop", status: "Planned", location: "Online", date: "2026", title: "Prepare a private class and invite your first learners", body: "Choose an approved language path, define the role of teacher or coordinator, set a schedule and price, then establish community rules." },
    { label: "Live conversation studio", status: "Planned", location: "Online · Live Chat", date: "2026", title: "Practice useful conversations with people and AI", body: "Learners join an instructor-defined scenario, use text or signed-in audio practice, and receive feedback without treating AI scores as official exam results." },
  ],
  zh: [
    { label: "语言路径说明会", status: "规划中", location: "线上 · 中英双语", date: "2026", title: "选择语言并完成第一轮每日学习", body: "了解水平定位、短课、词汇复习、听说读写训练、人工智能导师与安全的社交学习。" },
    { label: "班级协调员工作坊", status: "规划中", location: "线上", date: "2026", title: "准备私有班级并邀请第一批学员", body: "选择经批准的语言路径，确定老师或协调员角色，设置日程与价格，并建立社区规则。" },
    { label: "实时会话练习室", status: "规划中", location: "线上 · 实时聊天", date: "2026", title: "和同学及人工智能练习实用会话", body: "参加老师定义的场景，用文字或登录后的语音练习；人工智能反馈用于训练，不作为官方考试成绩。" },
  ],
};

function valid(value: unknown): value is EditorialDocument { const v = value as EditorialDocument; return Boolean(v && typeof v.editionDate === "string" && Array.isArray(v.zh) && Array.isArray(v.en)); }
export async function getEditorialDocument(kind: "news" | "events", fallback: EditorialDocument) {
  try { const row = await getDatabase().prepare("SELECT edition_date AS editionDate, payload FROM editorial_documents WHERE kind = ?").bind(kind).first<{ editionDate: string; payload: string }>(); if (!row) return fallback; const value = JSON.parse(row.payload); return valid(value) ? { ...value, editionDate: row.editionDate } : fallback; } catch { return fallback; }
}
