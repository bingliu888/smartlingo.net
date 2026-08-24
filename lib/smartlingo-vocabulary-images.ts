export const BEGINNER_VOCABULARY_SPRITE = "/images/smartcards/beginner-vocabulary-sprite-2026-08-23.png" as const;

export const BEGINNER_VOCABULARY_IMAGE_KEYS = [
  "coffee", "water", "bread", "egg", "milk", "rice", "apple", "banana",
  "meat", "vegetables", "bus", "train", "hotel", "hospital", "book", "school",
] as const;

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
};

export function beginnerVocabularyImageKey(...values: Array<string | null | undefined>): BeginnerVocabularyImageKey | null {
  const normalized = values.filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase();
  for (const key of BEGINNER_VOCABULARY_IMAGE_KEYS) {
    if (MATCHERS[key].some(term => normalized.includes(term.toLocaleLowerCase()))) return key;
  }
  return null;
}

export function beginnerVocabularySpritePosition(key: BeginnerVocabularyImageKey) {
  const index = BEGINNER_VOCABULARY_IMAGE_KEYS.indexOf(key);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return `${column * 100 / 3}% ${row * 100 / 3}%`;
}
