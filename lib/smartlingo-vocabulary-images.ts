import {
  BEGINNER_SEMANTIC_CONCEPTS,
  BEGINNER_SEMANTIC_GRID_SIZE,
  type BeginnerSemanticImageKey,
} from "./smartlingo-semantic-media-catalog.ts";

export const BEGINNER_VOCABULARY_SPRITE = "/images/smartcards/beginner-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_SOCIAL_VOCABULARY_SPRITE = "/images/smartcards/beginner-social-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_PRACTICAL_VOCABULARY_SPRITE = "/images/smartcards/beginner-practical-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_GRAMMAR_VOCABULARY_SPRITE = "/images/smartcards/beginner-grammar-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_RELATIONSHIP_VOCABULARY_SPRITE = "/images/smartcards/beginner-relationship-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_CONCEPT_VOCABULARY_SPRITE = "/images/smartcards/beginner-concept-vocabulary-sprite-2026-08-23.png" as const;

export const BEGINNER_OBJECT_IMAGE_KEYS = [
  "coffee", "water", "bread", "egg", "milk", "rice", "apple", "banana",
  "meat", "vegetables", "bus", "train", "hotel", "hospital", "book", "school",
] as const;

export const BEGINNER_SOCIAL_IMAGE_KEYS = [
  "hello", "please", "thanks", "sorry", "yes", "no", "goodbye", "help",
  "man", "woman", "child", "friend", "home", "family", "food", "phone",
] as const;

export const BEGINNER_PRACTICAL_IMAGE_KEYS = [
  "my_name_is", "i_am_from", "airport", "ticket", "gate", "where_is", "left", "right",
  "straight_ahead", "restroom", "menu", "vegetarian", "how_much", "cash", "card", "receipt",
] as const;

export const BEGINNER_GRAMMAR_IMAGE_KEYS = [
  "i_am_lost", "doctor", "police", "the", "to", "and", "of", "a", "in", "i", "is", "for",
  "that", "you", "it", "on",
] as const;

export const BEGINNER_RELATIONSHIP_IMAGE_KEYS = [
  "with", "this", "was", "be", "as", "are", "have", "at", "he", "not", "by", "but", "from",
  "my", "or", "we",
] as const;

export const BEGINNER_CONCEPT_IMAGE_KEYS = [
  "an", "your", "all", "so", "his", "they", "me", "if", "one", "can", "will", "just", "like",
  "about", "up", "out",
] as const;

export const BEGINNER_VOCABULARY_IMAGE_KEYS = [
  ...BEGINNER_OBJECT_IMAGE_KEYS,
  ...BEGINNER_SOCIAL_IMAGE_KEYS,
  ...BEGINNER_PRACTICAL_IMAGE_KEYS,
  ...BEGINNER_GRAMMAR_IMAGE_KEYS,
  ...BEGINNER_RELATIONSHIP_IMAGE_KEYS,
  ...BEGINNER_CONCEPT_IMAGE_KEYS,
] as const;

type BaseBeginnerVocabularyImageKey = (typeof BEGINNER_VOCABULARY_IMAGE_KEYS)[number];
export type BeginnerVocabularyImageKey = BaseBeginnerVocabularyImageKey | BeginnerSemanticImageKey;

const MATCHERS: Record<BaseBeginnerVocabularyImageKey, readonly string[]> = {
  coffee: ["coffee", "咖啡", "コーヒー", "커피", "café", "kaffee", "кофе", "caffè", "cafe", "قهوة", "कॉफी"],
  water: ["water", "水", "みず", "水", "물", "agua", "eau", "wasser", "вода", "acqua", "água", "ماء", "पानी"],
  bread: ["bread", "面包", "パン", "빵", "pan", "pain", "brot", "хлеб", "pane", "pão", "خبز", "रोटी"],
  egg: ["egg", "eggs", "鸡蛋", "卵", "たまご", "계란", "huevo", "œuf", "ei", "яйцо", "uovo", "ovo", "بيض", "अंडा"],
  milk: ["milk", "牛奶", "ミルク", "牛乳", "우유", "leche", "lait", "milch", "молоко", "latte", "leite", "حليب", "दूध"],
  rice: ["rice", "米饭", "大米", "ご飯", "米", "밥", "arroz", "riz", "reis", "рис", "riso", "أرز", "चावल"],
  apple: ["apple", "苹果", "りんご", "リンゴ", "사과", "manzana", "pomme", "apfel", "яблоко", "mela", "maçã", "تفاح", "सेब"],
  banana: ["banana", "香蕉", "バナナ", "바나나", "banane", "банан", "موز", "केला"],
  meat: ["meat", "肉", "牛肉", "にく", "肉", "고기", "carne", "viande", "fleisch", "мясо", "لحم", "मांस"],
  vegetables: ["vegetable", "vegetables", "蔬菜", "野菜", "やさい", "채소", "verdura", "verduras", "légume", "gemüse", "овощ", "legume", "خضروات", "सब्ज"],
  bus: ["bus", "公交", "巴士", "バス", "버스", "autobús", "bus", "автобус", "ônibus", "حافلة", "बस"],
  train: ["train", "火车", "列车", "電車", "でんしゃ", "열차", "tren", "zug", "поезд", "treno", "trem", "قطار", "ट्रेन"],
  hotel: ["hotel", "酒店", "旅馆", "ホテル", "호텔", "hôtel", "гостиница", "albergo", "فندق", "होटल"],
  hospital: ["hospital", "医院", "病院", "びょういん", "병원", "hôpital", "krankenhaus", "больница", "ospedale", "hospital", "مستشفى", "अस्पताल"],
  book: ["book", "书", "本", "ほん", "책", "libro", "livre", "buch", "книга", "livro", "كتاب", "किताब"],
  school: ["school", "学校", "がっこう", "학교", "escuela", "école", "schule", "школа", "scuola", "escola", "مدرسة", "स्कूल"],
  hello: ["hello", "hi", "你好", "您好", "こんにちは", "안녕", "hola", "bonjour", "hallo", "привет", "ciao", "olá", "مرحبا", "नमस्ते"],
  please: ["please", "请", "拜托", "ください", "お願い", "제발", "por favor", "s'il vous plaît", "bitte", "пожалуйста", "per favore", "por favor", "من فضلك", "कृपया"],
  thanks: ["thank", "谢谢", "感谢", "ありがとう", "감사", "gracias", "merci", "danke", "спасибо", "grazie", "obrigad", "شكرا", "धन्यवाद"],
  sorry: ["sorry", "excuse", "对不起", "抱歉", "劳驾", "すみません", "ごめん", "미안", "perdón", "désolé", "entschuld", "извин", "scusa", "desculp", "آسف", "माफ"],
  yes: ["yes", "是的", "はい", "네", "sí", "oui", "ja", "да", "sim", "نعم", "हाँ"],
  no: ["no", "不是", "不", "いいえ", "아니", "non", "nein", "нет", "não", "لا", "नहीं"],
  goodbye: ["goodbye", "bye", "再见", "さようなら", "またね", "안녕히", "adiós", "au revoir", "tschüss", "до свидания", "arrivederci", "tchau", "وداعا", "अलविदा"],
  help: ["help", "帮助", "帮忙", "助け", "도와", "ayuda", "aide", "hilfe", "помощ", "aiuto", "ajuda", "مساعدة", "मदद"],
  man: ["man", "男人", "男子", "男の人", "남자", "hombre", "homme", "mann", "мужчина", "uomo", "homem", "رجل", "आदमी"],
  woman: ["woman", "女人", "女子", "女の人", "여자", "mujer", "femme", "frau", "женщина", "donna", "mulher", "امرأة", "महिला"],
  child: ["child", "kid", "孩子", "儿童", "子ども", "아이", "niño", "enfant", "kind", "ребенок", "bambino", "criança", "طفل", "बच्च"],
  friend: ["friend", "朋友", "友達", "친구", "amigo", "ami", "freund", "друг", "amico", "صديق", "दोस्त"],
  home: ["home", "house", "家", "房子", "うち", "家", "집", "casa", "maison", "haus", "дом", "بيت", "घर"],
  family: ["family", "家人", "家庭", "家族", "가족", "familia", "famille", "familie", "семья", "famiglia", "عائلة", "परिवार"],
  food: ["food", "meal", "食物", "饭", "食べ物", "ご飯", "음식", "comida", "nourriture", "essen", "еда", "cibo", "طعام", "खाना"],
  phone: ["phone", "smartphone", "手机", "电话", "携帯", "電話", "휴대폰", "teléfono", "téléphone", "handy", "телефон", "telefono", "celular", "هاتف", "फ़ोन"],
  my_name_is: ["my name is", "我的名字是"],
  i_am_from: ["i am from", "我来自"],
  airport: ["airport", "机场"],
  ticket: ["ticket", "票", "车票", "机票"],
  gate: ["boarding gate", "gate", "登机口", "入口"],
  where_is: ["where is", "在哪里"],
  left: ["left", "左边", "向左"],
  right: ["right", "右边", "向右"],
  straight_ahead: ["straight ahead", "一直往前", "直走"],
  restroom: ["restroom", "toilet", "洗手间", "厕所"],
  menu: ["menu", "菜单"],
  vegetarian: ["vegetarian", "素食"],
  how_much: ["how much", "多少钱"],
  cash: ["cash", "现金"],
  card: ["payment card", "bank card", "credit card", "card", "银行卡"],
  receipt: ["receipt", "收据"],
  i_am_lost: ["i am lost", "我迷路了"],
  doctor: ["doctor", "physician", "医生"],
  police: ["police", "警察"],
  the: ["the definite article", "定冠词"],
  to: ["toward; used before an infinitive", "向；到；用于动词不定式"],
  and: ["used to join words or ideas", "和；以及"],
  of: ["belonging to; relating to", "……的；关于"],
  a: ["one; an indefinite article", "一个；不定冠词"],
  in: ["inside; within", "在……里面；在……期间"],
  i: ["the speaker", "我"],
  is: ["third-person singular form of be", "是（第三人称单数）"],
  for: ["intended for; because of", "为了；给；因为"],
  that: ["the person or thing there; used to introduce a clause", "那个；那；引导从句"],
  you: ["the person or people being addressed", "你；你们"],
  it: ["a thing or situation already mentioned", "它；这件事"],
  on: ["on the surface of; about", "在……上面；关于"],
  with: ["together with; using", "和……一起；用"],
  this: ["the person or thing here", "这个；这"],
  was: ["past singular form of be", "是；在（过去式单数）"],
  be: ["to exist; to have a quality or identity", "是；存在；成为"],
  as: ["in the role of; while", "作为；像；当……时"],
  are: ["present plural form of be", "是（复数或第二人称）"],
  have: ["to own; to experience", "有；拥有；经历"],
  at: ["in or near a place or time", "在某地点或时间"],
  he: ["a male person already mentioned", "他"],
  not: ["used to make a word or statement negative", "不；没有"],
  by: ["near; through the action of", "在旁边；由；通过"],
  but: ["used to introduce a contrast", "但是；不过"],
  from: ["starting at; originating in", "从；来自"],
  my: ["belonging to me", "我的"],
  or: ["used to show an alternative", "或者；还是"],
  we: ["the speaker and one or more other people", "我们"],
  an: ["one; an indefinite article before a vowel sound", "一个；用于元音音素前的不定冠词"],
  your: ["belonging to you", "你的；你们的"],
  all: ["the whole number or amount", "全部；所有"],
  so: ["therefore; to such a degree", "所以；如此"],
  his: ["belonging to him", "他的"],
  they: ["people or things already mentioned", "他们；她们；它们"],
  me: ["the speaker as an object", "我（宾格）"],
  if: ["on the condition that; whether", "如果；是否"],
  one: ["the number 1; a single person or thing", "一；一个"],
  can: ["to be able to; to be allowed to", "能；可以"],
  will: ["used for the future or willingness", "将会；愿意"],
  just: ["exactly; only; a short time ago", "正好；只是；刚刚"],
  like: ["to enjoy or prefer", "喜欢；想要"],
  about: ["concerning; approximately", "关于；大约"],
  up: ["toward a higher place or level", "向上；提高"],
  out: ["away from the inside", "出去；在外"],
};

function normalizeMediaTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mediaTermMatches(value: string, term: string) {
  if (value === term) return true;
  const compactLength = [...term.replace(/[^\p{L}\p{N}]/gu, "")].length;
  if (compactLength <= 2) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}($|[^\\p{L}\\p{N}])`, "u").test(value);
}

const BASE_CANDIDATES = BEGINNER_VOCABULARY_IMAGE_KEYS.flatMap(key =>
  MATCHERS[key].map(term => ({ key, term: normalizeMediaTerm(term) })),
).sort((left, right) => right.term.length - left.term.length);

const SEMANTIC_CONCEPT_BY_KEY = new Map<string, (typeof BEGINNER_SEMANTIC_CONCEPTS)[number]>(
  BEGINNER_SEMANTIC_CONCEPTS.map(concept => [concept.key, concept]),
);

const SEMANTIC_EXACT_MATCHERS = new Map<string, BeginnerSemanticImageKey>();
for (const concept of BEGINNER_SEMANTIC_CONCEPTS) {
  for (const rawTerm of [...concept.terms, ...concept.meaningsZh]) {
    const term = normalizeMediaTerm(rawTerm);
    if (!term || SEMANTIC_EXACT_MATCHERS.has(term)) continue;
    SEMANTIC_EXACT_MATCHERS.set(term, concept.key);
  }
}

export function baseBeginnerVocabularyImageKey(...values: Array<string | null | undefined>): BaseBeginnerVocabularyImageKey | null {
  const normalizedValues = values.filter((value): value is string => Boolean(value)).map(normalizeMediaTerm);
  for (const candidate of BASE_CANDIDATES) {
    if (normalizedValues.some(value => mediaTermMatches(value, candidate.term))) return candidate.key;
  }
  return null;
}

export function beginnerVocabularyImageKey(...values: Array<string | null | undefined>): BeginnerVocabularyImageKey | null {
  const baseKey = baseBeginnerVocabularyImageKey(...values);
  if (baseKey) return baseKey;
  const normalizedValues = values.filter((value): value is string => Boolean(value)).map(normalizeMediaTerm);
  for (const value of normalizedValues) {
    const exact = SEMANTIC_EXACT_MATCHERS.get(value);
    if (exact) return exact;
  }
  return null;
}

export function beginnerVocabularySpritePosition(key: BeginnerVocabularyImageKey) {
  const group = spriteGroup(key);
  const column = group.index % group.gridSize;
  const row = Math.floor(group.index / group.gridSize);
  const denominator = group.gridSize - 1;
  return `${column * 100 / denominator}% ${row * 100 / denominator}%`;
}

export function beginnerVocabularySpriteSource(key: BeginnerVocabularyImageKey) {
  return spriteGroup(key).source;
}

export function beginnerVocabularySpriteSize(key: BeginnerVocabularyImageKey) {
  const gridSize = spriteGroup(key).gridSize;
  return `${gridSize * 100}% ${gridSize * 100}%`;
}

function spriteGroup(key: BeginnerVocabularyImageKey) {
  const semantic = SEMANTIC_CONCEPT_BY_KEY.get(key);
  if (semantic) {
    const source = semantic.mediaTier === "ai"
      ? `/images/smartcards/beginner-semantic-vocabulary-sprite-${String(semantic.sheet).padStart(2, "0")}-2026-08-23.png`
      : `/images/smartcards/beginner-semantic-fallback-sprite-${String(semantic.sheet).padStart(3, "0")}-2026-08-23.svg`;
    return {
      index: semantic.cell,
      gridSize: BEGINNER_SEMANTIC_GRID_SIZE,
      source,
    };
  }
  const groups = [
    { keys: BEGINNER_OBJECT_IMAGE_KEYS, source: BEGINNER_VOCABULARY_SPRITE },
    { keys: BEGINNER_SOCIAL_IMAGE_KEYS, source: BEGINNER_SOCIAL_VOCABULARY_SPRITE },
    { keys: BEGINNER_PRACTICAL_IMAGE_KEYS, source: BEGINNER_PRACTICAL_VOCABULARY_SPRITE },
    { keys: BEGINNER_GRAMMAR_IMAGE_KEYS, source: BEGINNER_GRAMMAR_VOCABULARY_SPRITE },
    { keys: BEGINNER_RELATIONSHIP_IMAGE_KEYS, source: BEGINNER_RELATIONSHIP_VOCABULARY_SPRITE },
    { keys: BEGINNER_CONCEPT_IMAGE_KEYS, source: BEGINNER_CONCEPT_VOCABULARY_SPRITE },
  ] as const;
  const group = groups.find(candidate => candidate.keys.includes(key as never)) || groups[0];
  return { index: group.keys.indexOf(key as never), gridSize: 4, source: group.source };
}
