export const BEGINNER_VOCABULARY_SPRITE = "/images/smartcards/beginner-vocabulary-sprite-2026-08-23.png" as const;
export const BEGINNER_SOCIAL_VOCABULARY_SPRITE = "/images/smartcards/beginner-social-vocabulary-sprite-2026-08-23.png" as const;

export const BEGINNER_OBJECT_IMAGE_KEYS = [
  "coffee", "water", "bread", "egg", "milk", "rice", "apple", "banana",
  "meat", "vegetables", "bus", "train", "hotel", "hospital", "book", "school",
] as const;

export const BEGINNER_SOCIAL_IMAGE_KEYS = [
  "hello", "please", "thanks", "sorry", "yes", "no", "goodbye", "help",
  "man", "woman", "child", "friend", "home", "family", "food", "phone",
] as const;

export const BEGINNER_VOCABULARY_IMAGE_KEYS = [...BEGINNER_OBJECT_IMAGE_KEYS, ...BEGINNER_SOCIAL_IMAGE_KEYS] as const;

export type BeginnerVocabularyImageKey = (typeof BEGINNER_VOCABULARY_IMAGE_KEYS)[number];

const MATCHERS: Record<BeginnerVocabularyImageKey, readonly string[]> = {
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
};

export function beginnerVocabularyImageKey(...values: Array<string | null | undefined>): BeginnerVocabularyImageKey | null {
  const normalized = values.filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase();
  const candidates = BEGINNER_VOCABULARY_IMAGE_KEYS.flatMap(key =>
    MATCHERS[key].map(term => ({ key, term: term.normalize("NFKC").toLocaleLowerCase() })),
  ).sort((left, right) => right.term.length - left.term.length);
  for (const candidate of candidates) {
    if (normalized.includes(candidate.term)) return candidate.key;
  }
  return null;
}

export function beginnerVocabularySpritePosition(key: BeginnerVocabularyImageKey) {
  const group = BEGINNER_OBJECT_IMAGE_KEYS.includes(key as (typeof BEGINNER_OBJECT_IMAGE_KEYS)[number])
    ? BEGINNER_OBJECT_IMAGE_KEYS
    : BEGINNER_SOCIAL_IMAGE_KEYS;
  const index = group.indexOf(key as never);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return `${column * 100 / 3}% ${row * 100 / 3}%`;
}

export function beginnerVocabularySpriteSource(key: BeginnerVocabularyImageKey) {
  return BEGINNER_OBJECT_IMAGE_KEYS.includes(key as (typeof BEGINNER_OBJECT_IMAGE_KEYS)[number])
    ? BEGINNER_VOCABULARY_SPRITE
    : BEGINNER_SOCIAL_VOCABULARY_SPRITE;
}
