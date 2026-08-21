import type { SmartLingoInterfaceLanguage, SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";

export const SMARTLINGO_SENTENCE_CONTENT_VERSION = "2026-08-21.1" as const;
export const SMARTLINGO_SENTENCES_PER_COURSE = 120 as const;
export const SMARTLINGO_SENTENCES_PER_ROUND = 10 as const;

type Scenario = {
  id: string;
  zh: string;
  en: string;
  places: Record<SmartLingoLearningLanguage, string>;
};

const SCENARIOS: readonly Scenario[] = [
  ["airport", "机场", "the airport", ["机场", "the airport", "el aeropuerto", "空港", "공항", "l’aéroport", "der Flughafen", "аэропорт", "l’aeroporto", "o aeroporto", "المطار", "हवाई अड्डा"]],
  ["hotel", "酒店", "the hotel", ["酒店", "the hotel", "el hotel", "ホテル", "호텔", "l’hôtel", "das Hotel", "отель", "l’hotel", "o hotel", "الفندق", "होटल"]],
  ["restaurant", "餐厅", "the restaurant", ["餐厅", "the restaurant", "el restaurante", "レストラン", "식당", "le restaurant", "das Restaurant", "ресторан", "il ristorante", "o restaurante", "المطعم", "रेस्तराँ"]],
  ["hospital", "医院", "the hospital", ["医院", "the hospital", "el hospital", "病院", "병원", "l’hôpital", "das Krankenhaus", "больница", "l’ospedale", "o hospital", "المستشفى", "अस्पताल"]],
  ["cafe", "咖啡店", "the coffee shop", ["咖啡店", "the coffee shop", "la cafetería", "カフェ", "카페", "le café", "das Café", "кафе", "il bar", "o café", "المقهى", "कैफ़े"]],
  ["school", "学校", "the school", ["学校", "the school", "la escuela", "学校", "학교", "l’école", "die Schule", "школа", "la scuola", "a escola", "المدرسة", "स्कूल"]],
  ["library", "图书馆", "the library", ["图书馆", "the library", "la biblioteca", "図書館", "도서관", "la bibliothèque", "die Bibliothek", "библиотека", "la biblioteca", "a biblioteca", "المكتبة", "पुस्तकालय"]],
  ["grocery", "食品店", "the grocery store", ["食品店", "the grocery store", "el supermercado", "食料品店", "식료품점", "l’épicerie", "der Supermarkt", "продуктовый магазин", "il supermercato", "o supermercado", "متجر البقالة", "किराने की दुकान"]],
  ["transit", "车站", "the station", ["车站", "the station", "la estación", "駅", "역", "la gare", "der Bahnhof", "станция", "la stazione", "a estação", "المحطة", "स्टेशन"]],
  ["pharmacy", "药店", "the pharmacy", ["药店", "the pharmacy", "la farmacia", "薬局", "약국", "la pharmacie", "die Apotheke", "аптека", "la farmacia", "a farmácia", "الصيدلية", "दवा की दुकान"]],
  ["bank", "银行", "the bank", ["银行", "the bank", "el banco", "銀行", "은행", "la banque", "die Bank", "банк", "la banca", "o banco", "البنك", "बैंक"]],
  ["police", "警察服务台", "the police help desk", ["警察服务台", "the police help desk", "el puesto de policía", "警察案内所", "경찰 안내소", "le poste de police", "die Polizeiwache", "полицейский участок", "il posto di polizia", "o posto policial", "مركز الشرطة", "पुलिस सहायता केंद्र"]],
].map(([id, zh, en, places]) => ({
  id: id as string,
  zh: zh as string,
  en: en as string,
  places: Object.fromEntries((["zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi"] as const).map((code, index) => [code, (places as string[])[index]])) as Record<SmartLingoLearningLanguage, string>,
}));

type TargetBuilder = (place: string) => readonly string[];

const TARGET_BUILDERS: Record<SmartLingoLearningLanguage, TargetBuilder> = {
  zh: p => [`${p}在哪里？`, `我在找${p}。`, `请告诉我怎么去${p}。`, `${p}离这里远吗？`, `${p}现在开门吗？`, `我需要去${p}。`, `请带我去${p}。`, `我们可以在${p}见面吗？`, `去${p}要多长时间？`, `谢谢你帮我找到${p}。`],
  en: p => [`Where is ${p}?`, `I am looking for ${p}.`, `Please show me how to get to ${p}.`, `Is ${p} far from here?`, `Is ${p} open now?`, `I need to go to ${p}.`, `Please take me to ${p}.`, `Can we meet at ${p}?`, `How long does it take to reach ${p}?`, `Thank you for helping me find ${p}.`],
  es: p => [`¿Dónde está ${p}?`, `Estoy buscando ${p}.`, `Por favor, dígame cómo llegar a ${p}.`, `¿Está ${p} lejos de aquí?`, `¿Está abierto ${p} ahora?`, `Necesito ir a ${p}.`, `Por favor, lléveme a ${p}.`, `¿Podemos encontrarnos en ${p}?`, `¿Cuánto se tarda en llegar a ${p}?`, `Gracias por ayudarme a encontrar ${p}.`],
  ja: p => [`${p}はどこですか。`, `${p}を探しています。`, `${p}への行き方を教えてください。`, `${p}はここから遠いですか。`, `${p}は今開いていますか。`, `${p}へ行く必要があります。`, `${p}へ連れて行ってください。`, `${p}で会えますか。`, `${p}までどのくらいかかりますか。`, `${p}を探すのを手伝ってくれてありがとうございます。`],
  ko: p => [`${p}은 어디예요?`, `${p}을 찾고 있어요.`, `${p}에 가는 길을 알려 주세요.`, `${p}은 여기서 멀어요?`, `${p}은 지금 열려 있어요?`, `${p}에 가야 해요.`, `${p}에 데려다 주세요.`, `${p}에서 만날 수 있어요?`, `${p}까지 얼마나 걸려요?`, `${p}을 찾는 것을 도와주셔서 감사합니다.`],
  fr: p => [`Où se trouve ${p} ?`, `Je cherche ${p}.`, `Montrez-moi comment aller à ${p}, s’il vous plaît.`, `${p} est loin d’ici ?`, `${p} est ouvert maintenant ?`, `Je dois aller à ${p}.`, `Emmenez-moi à ${p}, s’il vous plaît.`, `Pouvons-nous nous retrouver à ${p} ?`, `Combien de temps faut-il pour aller à ${p} ?`, `Merci de m’aider à trouver ${p}.`],
  de: p => [`Wo ist ${p}?`, `Ich suche ${p}.`, `Bitte zeigen Sie mir den Weg zu ${p}.`, `Ist ${p} weit von hier?`, `Ist ${p} jetzt geöffnet?`, `Ich muss zu ${p}.`, `Bitte bringen Sie mich zu ${p}.`, `Können wir uns bei ${p} treffen?`, `Wie lange dauert es bis zu ${p}?`, `Danke, dass Sie mir helfen, ${p} zu finden.`],
  ru: p => [`Где находится ${p}?`, `Я ищу ${p}.`, `Пожалуйста, покажите, как пройти в ${p}.`, `${p} далеко отсюда?`, `${p} сейчас открыт?`, `Мне нужно в ${p}.`, `Пожалуйста, отвезите меня в ${p}.`, `Мы можем встретиться у места «${p}»?`, `Сколько времени идти до места «${p}»?`, `Спасибо, что помогли мне найти ${p}.`],
  it: p => [`Dov’è ${p}?`, `Sto cercando ${p}.`, `Per favore, mi mostri come arrivare a ${p}.`, `${p} è lontano da qui?`, `${p} è aperto adesso?`, `Devo andare a ${p}.`, `Per favore, mi porti a ${p}.`, `Possiamo incontrarci a ${p}?`, `Quanto tempo ci vuole per arrivare a ${p}?`, `Grazie per avermi aiutato a trovare ${p}.`],
  pt: p => [`Onde fica ${p}?`, `Estou procurando ${p}.`, `Por favor, mostre-me como chegar a ${p}.`, `${p} fica longe daqui?`, `${p} está aberto agora?`, `Preciso ir a ${p}.`, `Por favor, leve-me a ${p}.`, `Podemos nos encontrar em ${p}?`, `Quanto tempo leva para chegar a ${p}?`, `Obrigado por me ajudar a encontrar ${p}.`],
  ar: p => [`أين ${p}؟`, `أنا أبحث عن ${p}.`, `من فضلك، أخبرني كيف أصل إلى ${p}.`, `هل ${p} بعيد من هنا؟`, `هل ${p} مفتوح الآن؟`, `أحتاج إلى الذهاب إلى ${p}.`, `من فضلك، خذني إلى ${p}.`, `هل يمكننا أن نلتقي عند ${p}؟`, `كم يستغرق الوصول إلى ${p}؟`, `شكرًا لمساعدتي في العثور على ${p}.`],
  hi: p => [`${p} कहाँ है?`, `मैं ${p} ढूँढ रहा हूँ।`, `कृपया मुझे ${p} जाने का रास्ता बताइए।`, `क्या ${p} यहाँ से दूर है?`, `क्या ${p} अभी खुला है?`, `मुझे ${p} जाना है।`, `कृपया मुझे ${p} ले चलिए।`, `क्या हम ${p} पर मिल सकते हैं?`, `${p} पहुँचने में कितना समय लगता है?`, `${p} ढूँढने में मेरी मदद करने के लिए धन्यवाद।`],
};

const ENGLISH_BUILD: TargetBuilder = p => [`Where is ${p}?`, `I am looking for ${p}.`, `Please show me how to get to ${p}.`, `Is ${p} far from here?`, `Is ${p} open now?`, `I need to go to ${p}.`, `Please take me to ${p}.`, `Can we meet at ${p}?`, `How long does it take to reach ${p}?`, `Thank you for helping me find ${p}.`];
const CHINESE_BUILD: TargetBuilder = p => [`${p}在哪里？`, `我在找${p}。`, `请告诉我怎么去${p}。`, `${p}离这里远吗？`, `${p}现在开门吗？`, `我需要去${p}。`, `请带我去${p}。`, `我们可以在${p}见面吗？`, `去${p}要多长时间？`, `谢谢你帮我找到${p}。`];

function levelSentence(sentence: string, level: SmartLingoLevel, language: SmartLingoLearningLanguage) {
  if (level === "beginner") return sentence;
  const prefix = language === "zh" ? (level === "intermediate" ? "请问，" : "如果方便的话，")
    : language === "ja" ? (level === "intermediate" ? "すみません、" : "もしよろしければ、")
    : language === "ko" ? (level === "intermediate" ? "실례합니다, " : "괜찮으시다면, ")
    : language === "es" ? (level === "intermediate" ? "Disculpe, " : "Si es posible, ")
    : language === "fr" ? (level === "intermediate" ? "Excusez-moi, " : "Si possible, ")
    : language === "de" ? (level === "intermediate" ? "Entschuldigung, " : "Wenn möglich, ")
    : language === "ru" ? (level === "intermediate" ? "Извините, " : "Если возможно, ")
    : language === "it" ? (level === "intermediate" ? "Mi scusi, " : "Se possibile, ")
    : language === "pt" ? (level === "intermediate" ? "Com licença, " : "Se possível, ")
    : language === "ar" ? (level === "intermediate" ? "عذرًا، " : "إذا أمكن، ")
    : language === "hi" ? (level === "intermediate" ? "माफ़ कीजिए, " : "यदि संभव हो, ")
    : (level === "intermediate" ? "Excuse me, " : "If possible, ");
  return `${prefix}${sentence.charAt(0).toLocaleLowerCase(language)}${sentence.slice(1)}`;
}

function localizedLevelSentence(sentence: string, level: SmartLingoLevel, uiLang: SmartLingoInterfaceLanguage) {
  if (level === "beginner") return sentence;
  const prefix = uiLang === "zh"
    ? (level === "intermediate" ? "请问，" : "如果方便的话，")
    : (level === "intermediate" ? "Excuse me, " : "If possible, ");
  return `${prefix}${uiLang === "en" ? sentence.charAt(0).toLowerCase() + sentence.slice(1) : sentence}`;
}

export type SmartLingoSentenceExercise = {
  id: string;
  contentVersion: typeof SMARTLINGO_SENTENCE_CONTENT_VERSION;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
  scenario: string;
  targetSentence: string;
  translation: { zh: string; en: string };
  anchorVocabulary: string;
};

export function buildCourseSentenceBank(language: SmartLingoLearningLanguage, level: SmartLingoLevel): readonly SmartLingoSentenceExercise[] {
  const rows = SCENARIOS.flatMap(scenario => {
    const targets = TARGET_BUILDERS[language](scenario.places[language]);
    const chinese = CHINESE_BUILD(scenario.zh);
    const english = ENGLISH_BUILD(scenario.en);
    return targets.map((targetSentence, index) => ({
      id: `sentence:${SMARTLINGO_SENTENCE_CONTENT_VERSION}:${language}:${level}:${scenario.id}:${index + 1}`,
      contentVersion: SMARTLINGO_SENTENCE_CONTENT_VERSION,
      language,
      level,
      scenario: scenario.id,
      targetSentence: levelSentence(targetSentence, level, language),
      translation: {
        zh: localizedLevelSentence(chinese[index], level, "zh"),
        en: localizedLevelSentence(english[index], level, "en"),
      },
      anchorVocabulary: scenario.places[language],
    }));
  });
  if (rows.length !== SMARTLINGO_SENTENCES_PER_COURSE) throw new Error("Each SmartLingo course must contain exactly 120 sentence exercises");
  return rows;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildDailySentenceRound(language: SmartLingoLearningLanguage, level: SmartLingoLevel, date: string, skill: "listening" | "writing") {
  const bank = buildCourseSentenceBank(language, level);
  const offset = stableHash(`${date}:${language}:${level}:${skill}:${SMARTLINGO_SENTENCE_CONTENT_VERSION}`) % bank.length;
  const stride = 37;
  return Array.from({ length: SMARTLINGO_SENTENCES_PER_ROUND }, (_, index) => bank[(offset + index * stride) % bank.length]);
}

export function tokenizeSentence(sentence: string, language: SmartLingoLearningLanguage | SmartLingoInterfaceLanguage) {
  const segmenter = new Intl.Segmenter(language, { granularity: "word" });
  return [...segmenter.segment(sentence)].filter(part => part.isWordLike).map(part => part.segment);
}

export function normalizeSentenceAnswer(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function gradeSentenceRound(expected: readonly SmartLingoSentenceExercise[], answer: string | null | undefined, skill: "listening" | "writing", uiLang: SmartLingoInterfaceLanguage) {
  let responses: unknown = [];
  try { responses = JSON.parse(answer || "[]"); } catch { responses = []; }
  const answers = Array.isArray(responses) ? responses.map(value => String(value)) : [];
  const scores = expected.map((exercise, index) => {
    const expectedAnswer = exercise.targetSentence;
    return normalizeSentenceAnswer(answers[index] || "") === normalizeSentenceAnswer(expectedAnswer) ? 100 : 0;
  });
  return {
    skill,
    score: Math.round(scores.reduce<number>((sum, score) => sum + score, 0) / Math.max(1, expected.length)),
    correctCount: scores.filter(score => score === 100).length,
    questionCount: expected.length,
    uiLang,
  };
}
