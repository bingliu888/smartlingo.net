import { beginnerVocabularySeedsForDay } from "./smartlingo-beginner-vocabulary.ts";
import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities.ts";
import { beginnerVocabularyImageKey } from "./smartlingo-vocabulary-images.ts";
import type { SmartLingoLevel } from "./smartlingo-learning.ts";
import { everydayDialogueLines, prebuiltEverydayDialogueLines, type EverydayDialogueLine } from "./smartlingo-everyday-dialogues.ts";

export const SMARTLINGO_EVERYDAY_SCENARIOS = [
  { id: "airport", icon: "✈", nameZh: "机场", nameEn: "Airport", goalZh: "问路、找登机口与处理行程", goalEn: "Ask directions, find the gate, and manage a trip", image: "/everyday-speaking/airport.jpg", days: [1, 3, 4], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/airport/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "hotel", icon: "▤", nameZh: "酒店", nameEn: "Hotel", goalZh: "礼貌入住、介绍自己与找设施", goalEn: "Check in, introduce yourself, and find facilities", image: "/everyday-speaking/hotel.jpg", days: [1, 2, 4], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/hotel/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "restaurant", icon: "●", nameZh: "餐厅", nameEn: "Restaurant", goalZh: "看菜单、点餐、说明需求与结账", goalEn: "Read the menu, order, express needs, and pay", image: "/everyday-speaking/restaurant.jpg", days: [1, 5, 6], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/restaurant/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "hospital", icon: "+", nameZh: "医院", nameEn: "Hospital", goalZh: "请求帮助、找医生与说明基本情况", goalEn: "Ask for help, find a doctor, and explain a basic need", image: "/everyday-speaking/hospital.jpg", days: [1, 7, 2], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/hospital/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "cafe", icon: "☕", nameZh: "咖啡店", nameEn: "Coffee shop", goalZh: "礼貌点单、确认选择与付款", goalEn: "Order politely, confirm a choice, and pay", image: "/everyday-speaking/cafe.jpg", days: [1, 5, 6], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/cafe/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "school", icon: "✎", nameZh: "学校", nameEn: "School", goalZh: "认识老师同学并找到教室", goalEn: "Meet teachers and classmates and find the room", image: "/everyday-speaking/school.jpg", days: [1, 2, 4], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/school/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "library", icon: "▥", nameZh: "图书馆", nameEn: "Library", goalZh: "找区域、询问方向与请求协助", goalEn: "Find a section, ask directions, and request help", image: "/everyday-speaking/library.jpg", days: [1, 4, 2], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/library/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "grocery", icon: "◇", nameZh: "食品店", nameEn: "Grocery store", goalZh: "找商品、询价、选择付款方式", goalEn: "Find groceries, ask prices, and choose payment", image: "/everyday-speaking/grocery.jpg", days: [1, 6, 5], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/grocery/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "transit", icon: "▰", nameZh: "车站", nameEn: "Train & metro", goalZh: "买票、找站台与确认方向", goalEn: "Buy a ticket, find the platform, and confirm direction", image: "/everyday-speaking/transit.jpg", days: [1, 3, 4], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/transit/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "pharmacy", icon: "✚", nameZh: "药店", nameEn: "Pharmacy", goalZh: "寻求非紧急帮助并购买用品", goalEn: "Ask for non-emergency help and buy an item", image: "/everyday-speaking/pharmacy.jpg", days: [1, 7, 6], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/pharmacy/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "bank", icon: "▦", nameZh: "银行", nameEn: "Bank", goalZh: "说明需求、确认金额与取得收据", goalEn: "State a need, confirm an amount, and get a receipt", image: "/everyday-speaking/bank.jpg", days: [1, 6, 2], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/bank/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
  { id: "police", icon: "◆", nameZh: "警察服务台", nameEn: "Police help desk", goalZh: "迷路或需要帮助时清楚求助", goalEn: "Ask clearly for help when lost or in need", image: "/everyday-speaking/police.jpg", days: [1, 7, 4], motionMedia: Array.from({ length: 10 }, (_, index) => `/everyday-speaking/police/conversation-${String(index + 1).padStart(2, "0")}.gif`) },
] as const;

export type SmartLingoEverydayScenarioId = (typeof SMARTLINGO_EVERYDAY_SCENARIOS)[number]["id"];

export function isSmartLingoEverydayScenario(value: string): value is SmartLingoEverydayScenarioId {
  return SMARTLINGO_EVERYDAY_SCENARIOS.some(scene => scene.id === value);
}

type Essential = { forms: Record<SmartLingoCommunityLanguage, string>; meaningZh: string; meaningEn: string; pronunciation?: Partial<Record<SmartLingoCommunityLanguage, string>> };

const GROCERY_ESSENTIALS: Essential[] = [
  { forms:{zh:"鸡蛋",en:"eggs",es:"huevos",ja:"卵",ko:"계란",fr:"œufs",de:"Eier",ru:"яйца",it:"uova",pt:"ovos",ar:"بيض",hi:"अंडे"},meaningZh:"鸡蛋",meaningEn:"eggs" },
  { forms:{zh:"肉",en:"meat",es:"carne",ja:"肉",ko:"고기",fr:"viande",de:"Fleisch",ru:"мясо",it:"carne",pt:"carne",ar:"لحم",hi:"मांस"},meaningZh:"肉",meaningEn:"meat" },
  { forms:{zh:"蔬菜",en:"vegetables",es:"verduras",ja:"野菜",ko:"채소",fr:"légumes",de:"Gemüse",ru:"овощи",it:"verdure",pt:"legumes",ar:"خضروات",hi:"सब्ज़ियाँ"},meaningZh:"蔬菜",meaningEn:"vegetables" },
  { forms:{zh:"牛奶",en:"milk",es:"leche",ja:"牛乳",ko:"우유",fr:"lait",de:"Milch",ru:"молоко",it:"latte",pt:"leite",ar:"حليب",hi:"दूध"},meaningZh:"牛奶",meaningEn:"milk" },
  { forms:{zh:"大米",en:"rice",es:"arroz",ja:"米",ko:"쌀",fr:"riz",de:"Reis",ru:"рис",it:"riso",pt:"arroz",ar:"أرز",hi:"चावल"},meaningZh:"大米",meaningEn:"rice" },
  { forms:{zh:"面包",en:"bread",es:"pan",ja:"パン",ko:"빵",fr:"pain",de:"Brot",ru:"хлеб",it:"pane",pt:"pão",ar:"خبز",hi:"रोटी"},meaningZh:"面包",meaningEn:"bread" },
  { forms:{zh:"苹果",en:"apple",es:"manzana",ja:"りんご",ko:"사과",fr:"pomme",de:"Apfel",ru:"яблоко",it:"mela",pt:"maçã",ar:"تفاح",hi:"सेब"},meaningZh:"苹果",meaningEn:"apple" },
  { forms:{zh:"香蕉",en:"banana",es:"banana",ja:"バナナ",ko:"바나나",fr:"banane",de:"Banane",ru:"банан",it:"banana",pt:"banana",ar:"موز",hi:"केला"},meaningZh:"香蕉",meaningEn:"banana" },
];

const CAFE_ESSENTIALS: Essential[] = [
  { forms:{zh:"咖啡",en:"coffee",es:"café",ja:"コーヒー",ko:"커피",fr:"café",de:"Kaffee",ru:"кофе",it:"caffè",pt:"café",ar:"قهوة",hi:"कॉफी"},meaningZh:"咖啡",meaningEn:"coffee" },
  { forms:{zh:"水",en:"water",es:"agua",ja:"水",ko:"물",fr:"eau",de:"Wasser",ru:"вода",it:"acqua",pt:"água",ar:"ماء",hi:"पानी"},meaningZh:"水",meaningEn:"water" },
  { forms:{zh:"牛奶",en:"milk",es:"leche",ja:"牛乳",ko:"우유",fr:"lait",de:"Milch",ru:"молоко",it:"latte",pt:"leite",ar:"حليب",hi:"दूध"},meaningZh:"牛奶",meaningEn:"milk" },
  { forms:{zh:"面包",en:"bread",es:"pan",ja:"パン",ko:"빵",fr:"pain",de:"Brot",ru:"хлеб",it:"pane",pt:"pão",ar:"خبز",hi:"रोटी"},meaningZh:"面包",meaningEn:"bread" },
];

export function buildEverydaySpeakingDeck(language: SmartLingoCommunityLanguage, sceneId: SmartLingoEverydayScenarioId, level: SmartLingoLevel = "beginner") {
  const scene = SMARTLINGO_EVERYDAY_SCENARIOS.find(item => item.id === sceneId)!;
  const essentials = sceneId === "grocery" ? GROCERY_ESSENTIALS : sceneId === "cafe" ? CAFE_ESSENTIALS : null;
  const vocabulary = essentials
    ? essentials.map((item, index) => ({ id:`${scene.id}-${level}-word-${index + 1}`,kind:"word" as const,form:item.forms[language],pronunciation:item.pronunciation?.[language] || "",meaningZh:item.meaningZh,meaningEn:item.meaningEn,stageZh:"先认识实物",stageEn:"Meet the essentials",imageKey:beginnerVocabularyImageKey(item.forms[language],item.meaningZh,item.meaningEn) }))
    : scene.days.slice(0,2).flatMap((day,stageIndex)=>beginnerVocabularySeedsForDay(language,day).map((seed,itemIndex)=>({id:`${scene.id}-${level}-word-${stageIndex + 1}-${itemIndex + 1}`,kind:"word" as const,form:seed[0],pronunciation:seed[1],meaningZh:seed[2],meaningEn:seed[3],stageZh:"场景关键词",stageEn:"Scene essentials",imageKey:beginnerVocabularyImageKey(seed[0],seed[2],seed[3])})));
  const sentences = dialogueSlides(scene.id, level, prebuiltEverydayDialogueLines(scene.id, language, level));
  return [...vocabulary, ...sentences];
}

function dialogueSlides(sceneId: SmartLingoEverydayScenarioId, level: SmartLingoLevel, lines: readonly EverydayDialogueLine[]) {
  return lines.map((line, index) => ({
    id: `${sceneId}-${level}-dialogue-${line.pairIndex + 1}-${line.role}`,
    kind: "sentence" as const,
    role: line.role,
    pairIndex: line.pairIndex,
    form: line.target,
    pronunciation: "",
    meaningZh: line.meaningZh,
    meaningEn: line.meaningEn,
    stageZh: level === "beginner" ? "完成基本任务" : level === "intermediate" ? "处理更多变化" : "自然应对复杂情况",
    stageEn: level === "beginner" ? "Complete the basic task" : level === "intermediate" ? "Handle more variation" : "Navigate a complex situation",
    imageKey: beginnerVocabularyImageKey(line.target, line.meaningZh, line.meaningEn),
    anchorVocabulary: line.target,
    turnNumber: index + 1,
  }));
}

export async function buildEverydaySpeakingDeckFromDatabase(input: {
  database: Parameters<typeof everydayDialogueLines>[0]["database"];
  language: SmartLingoCommunityLanguage;
  sceneId: SmartLingoEverydayScenarioId;
  level?: SmartLingoLevel;
}) {
  const level = input.level || "beginner";
  const baseDeck = buildEverydaySpeakingDeck(input.language, input.sceneId, level);
  const vocabulary = baseDeck.filter(item => item.kind === "word");
  const dialogue = await everydayDialogueLines({ database: input.database, sceneId: input.sceneId, language: input.language, level });
  return [...vocabulary, ...dialogueSlides(input.sceneId, level, dialogue.lines)];
}
