import { beginnerVocabularySeedsForDay } from "./smartlingo-beginner-vocabulary.ts";
import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities.ts";

export const SMARTLINGO_EVERYDAY_SCENARIOS = [
  { id: "airport", icon: "✈", nameZh: "机场", nameEn: "Airport", goalZh: "问路、找登机口与处理行程", goalEn: "Ask directions, find the gate, and manage a trip", image: "/everyday-speaking/airport.jpg", days: [1, 3, 4] },
  { id: "hotel", icon: "▤", nameZh: "酒店", nameEn: "Hotel", goalZh: "礼貌入住、介绍自己与找设施", goalEn: "Check in, introduce yourself, and find facilities", image: "/everyday-speaking/hotel.jpg", days: [1, 2, 4] },
  { id: "restaurant", icon: "●", nameZh: "餐厅", nameEn: "Restaurant", goalZh: "看菜单、点餐、说明需求与结账", goalEn: "Read the menu, order, express needs, and pay", image: "/everyday-speaking/restaurant.jpg", days: [1, 5, 6] },
  { id: "hospital", icon: "+", nameZh: "医院", nameEn: "Hospital", goalZh: "请求帮助、找医生与说明基本情况", goalEn: "Ask for help, find a doctor, and explain a basic need", image: "/everyday-speaking/hospital.jpg", days: [1, 7, 2] },
  { id: "cafe", icon: "☕", nameZh: "咖啡店", nameEn: "Coffee shop", goalZh: "礼貌点单、确认选择与付款", goalEn: "Order politely, confirm a choice, and pay", image: "/everyday-speaking/cafe.jpg", days: [1, 5, 6] },
  { id: "school", icon: "✎", nameZh: "学校", nameEn: "School", goalZh: "认识老师同学并找到教室", goalEn: "Meet teachers and classmates and find the room", image: "/everyday-speaking/school.jpg", days: [1, 2, 4] },
  { id: "library", icon: "▥", nameZh: "图书馆", nameEn: "Library", goalZh: "找区域、询问方向与请求协助", goalEn: "Find a section, ask directions, and request help", image: "/everyday-speaking/library.jpg", days: [1, 4, 2] },
  { id: "grocery", icon: "◇", nameZh: "食品店", nameEn: "Grocery store", goalZh: "找商品、询价、选择付款方式", goalEn: "Find groceries, ask prices, and choose payment", image: "/everyday-speaking/grocery.jpg", days: [1, 6, 5] },
  { id: "transit", icon: "▰", nameZh: "车站", nameEn: "Train & metro", goalZh: "买票、找站台与确认方向", goalEn: "Buy a ticket, find the platform, and confirm direction", image: "/everyday-speaking/transit.jpg", days: [1, 3, 4] },
  { id: "pharmacy", icon: "✚", nameZh: "药店", nameEn: "Pharmacy", goalZh: "寻求非紧急帮助并购买用品", goalEn: "Ask for non-emergency help and buy an item", image: "/everyday-speaking/pharmacy.jpg", days: [1, 7, 6] },
  { id: "bank", icon: "▦", nameZh: "银行", nameEn: "Bank", goalZh: "说明需求、确认金额与取得收据", goalEn: "State a need, confirm an amount, and get a receipt", image: "/everyday-speaking/bank.jpg", days: [1, 6, 2] },
  { id: "police", icon: "◆", nameZh: "警察服务台", nameEn: "Police help desk", goalZh: "迷路或需要帮助时清楚求助", goalEn: "Ask clearly for help when lost or in need", image: "/everyday-speaking/police.jpg", days: [1, 7, 4] },
] as const;

export type SmartLingoEverydayScenarioId = (typeof SMARTLINGO_EVERYDAY_SCENARIOS)[number]["id"];

export function isSmartLingoEverydayScenario(value: string): value is SmartLingoEverydayScenarioId {
  return SMARTLINGO_EVERYDAY_SCENARIOS.some(scene => scene.id === value);
}

export function buildEverydaySpeakingDeck(language: SmartLingoCommunityLanguage, sceneId: SmartLingoEverydayScenarioId) {
  const scene = SMARTLINGO_EVERYDAY_SCENARIOS.find(item => item.id === sceneId)!;
  const stages = [
    { zh: "礼貌开场", en: "Polite opening" },
    { zh: "场景关键词", en: "Scene essentials" },
    { zh: "完成基本任务", en: "Complete the task" },
  ] as const;
  return scene.days.flatMap((day, stageIndex) => beginnerVocabularySeedsForDay(language, day).map((seed, itemIndex) => ({
    id: `${scene.id}-${stageIndex + 1}-${itemIndex + 1}`,
    form: seed[0],
    pronunciation: seed[1],
    meaningZh: seed[2],
    meaningEn: seed[3],
    stageZh: stages[stageIndex].zh,
    stageEn: stages[stageIndex].en,
  })));
}
