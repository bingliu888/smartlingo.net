import type { SmartLingoCommunityLanguage } from "./smartlingo-language-communities.ts";

export const SMARTLINGO_BEGINNER_VOCABULARY_VERSION = "2026-08-02.1" as const;

export const SMARTLINGO_BEGINNER_SCENES = [
  "greetings",
  "introductions",
  "transport",
  "directions",
  "restaurant",
  "shopping",
  "help",
] as const;

export type SmartLingoBeginnerScene = (typeof SMARTLINGO_BEGINNER_SCENES)[number];

type VocabularySeed = readonly [
  form: string,
  pronunciation: string,
  meaningZh: string,
  meaningEn: string,
];

type SevenDayVocabularySeed = readonly [
  greetings: readonly VocabularySeed[],
  introductions: readonly VocabularySeed[],
  transport: readonly VocabularySeed[],
  directions: readonly VocabularySeed[],
  restaurant: readonly VocabularySeed[],
  shopping: readonly VocabularySeed[],
  help: readonly VocabularySeed[],
];

/**
 * Original SmartLingo survival-language seeds. Each language follows the same
 * seven communicative scenes, but the forms are natural to the target language.
 * National flags and country assumptions are deliberately excluded.
 */
export const SMARTLINGO_BEGINNER_VOCABULARY_SEEDS = {
  en: [
    [["hello", "/həˈloʊ/", "你好", "hello"], ["please", "/pliːz/", "请", "please"], ["thank you", "/ˈθæŋk juː/", "谢谢", "thank you"], ["excuse me", "/ɪkˈskjuːz miː/", "劳驾；不好意思", "excuse me"]],
    [["my name is…", "/maɪ neɪm ɪz/", "我的名字是……", "my name is…"], ["I am from…", "/aɪ æm frəm/", "我来自……", "I am from…"], ["yes", "/jes/", "是；好的", "yes"], ["no", "/noʊ/", "不；不是", "no"]],
    [["airport", "/ˈer.pɔːrt/", "机场", "airport"], ["ticket", "/ˈtɪk.ɪt/", "票", "ticket"], ["gate", "/ɡeɪt/", "登机口；入口", "gate"], ["where is…?", "/wer ɪz/", "……在哪里？", "where is…?"]],
    [["left", "/left/", "左边", "left"], ["right", "/raɪt/", "右边", "right"], ["straight ahead", "/streɪt əˈhed/", "一直往前", "straight ahead"], ["restroom", "/ˈrest.ruːm/", "洗手间", "restroom"]],
    [["menu", "/ˈmen.juː/", "菜单", "menu"], ["water", "/ˈwɔː.tər/", "水", "water"], ["vegetarian", "/ˌvedʒ.əˈter.i.ən/", "素食的；素食者", "vegetarian"], ["the bill, please", "/ðə bɪl pliːz/", "请结账", "the bill, please"]],
    [["how much?", "/haʊ mʌtʃ/", "多少钱？", "how much?"], ["cash", "/kæʃ/", "现金", "cash"], ["card", "/kɑːrd/", "银行卡；卡", "card"], ["receipt", "/rɪˈsiːt/", "收据", "receipt"]],
    [["help!", "/help/", "救命；请帮忙", "help!"], ["I am lost", "/aɪ æm lɔːst/", "我迷路了", "I am lost"], ["doctor", "/ˈdɒk.tər/", "医生", "doctor"], ["police", "/pəˈliːs/", "警察", "police"]],
  ],
  zh: [
    [["你好", "nǐ hǎo", "你好", "hello"], ["请", "qǐng", "请；用于礼貌请求", "please"], ["谢谢", "xiè xie", "谢谢", "thank you"], ["不好意思", "bù hǎo yì si", "劳驾；不好意思", "excuse me"]],
    [["我叫……", "wǒ jiào", "我的名字是……", "my name is…"], ["我来自……", "wǒ lái zì", "我来自……", "I am from…"], ["是", "shì", "是", "yes; to be"], ["不是", "bú shì", "不是；不", "no; is not"]],
    [["机场", "jī chǎng", "机场", "airport"], ["票", "piào", "票", "ticket"], ["登机口", "dēng jī kǒu", "登机口", "boarding gate"], ["……在哪里？", "zài nǎ lǐ", "……在哪里？", "where is…?"]],
    [["左边", "zuǒ biān", "左边", "left"], ["右边", "yòu biān", "右边", "right"], ["一直走", "yì zhí zǒu", "一直往前走", "go straight"], ["洗手间", "xǐ shǒu jiān", "洗手间", "restroom"]],
    [["菜单", "cài dān", "菜单", "menu"], ["水", "shuǐ", "水", "water"], ["素食", "sù shí", "素食", "vegetarian food"], ["请结账", "qǐng jié zhàng", "请结账", "the bill, please"]],
    [["多少钱？", "duō shao qián", "多少钱？", "how much?"], ["现金", "xiàn jīn", "现金", "cash"], ["刷卡", "shuā kǎ", "用银行卡付款", "pay by card"], ["收据", "shōu jù", "收据", "receipt"]],
    [["帮帮我！", "bāng bang wǒ", "请帮帮我", "help me!"], ["我迷路了", "wǒ mí lù le", "我迷路了", "I am lost"], ["医生", "yī shēng", "医生", "doctor"], ["警察", "jǐng chá", "警察", "police"]],
  ],
  es: [
    [["hola", "/ˈola/", "你好", "hello"], ["por favor", "/poɾ faˈβoɾ/", "请", "please"], ["gracias", "/ˈɡɾasjas/", "谢谢", "thank you"], ["perdón", "/peɾˈdon/", "劳驾；对不起", "excuse me; sorry"]],
    [["me llamo…", "/me ˈʝamo/", "我叫……", "my name is…"], ["soy de…", "/soj ðe/", "我来自……", "I am from…"], ["sí", "/si/", "是；好的", "yes"], ["no", "/no/", "不；不是", "no"]],
    [["aeropuerto", "/aeɾoˈpweɾto/", "机场", "airport"], ["billete", "/biˈʝete/", "票", "ticket"], ["puerta", "/ˈpweɾta/", "登机口；门", "gate; door"], ["¿dónde está…?", "/ˈdonde esˈta/", "……在哪里？", "where is…?"]],
    [["izquierda", "/isˈkjeɾða/", "左边", "left"], ["derecha", "/deˈɾetʃa/", "右边", "right"], ["todo recto", "/ˈtoðo ˈrekto/", "一直往前", "straight ahead"], ["baño", "/ˈbaɲo/", "洗手间", "restroom"]],
    [["menú", "/meˈnu/", "菜单", "menu"], ["agua", "/ˈaɣwa/", "水", "water"], ["vegetariano", "/βexe taˈɾjano/", "素食的；素食者", "vegetarian"], ["la cuenta, por favor", "/la ˈkwenta poɾ faˈβoɾ/", "请结账", "the bill, please"]],
    [["¿cuánto cuesta?", "/ˈkwanto ˈkwesta/", "多少钱？", "how much does it cost?"], ["efectivo", "/efekˈtiβo/", "现金", "cash"], ["tarjeta", "/taɾˈxeta/", "银行卡；卡", "card"], ["recibo", "/reˈsiβo/", "收据", "receipt"]],
    [["¡ayuda!", "/aˈʝuða/", "救命；请帮忙", "help!"], ["estoy perdido", "/esˈtoj peɾˈðiðo/", "我迷路了", "I am lost"], ["médico", "/ˈmeðiko/", "医生", "doctor"], ["policía", "/poliˈsia/", "警察", "police"]],
  ],
  fr: [
    [["bonjour", "/bɔ̃.ʒuʁ/", "你好；日安", "hello; good day"], ["s'il vous plaît", "/sil vu plɛ/", "请", "please"], ["merci", "/mɛʁ.si/", "谢谢", "thank you"], ["excusez-moi", "/ɛks.ky.ze mwa/", "劳驾；对不起", "excuse me"]],
    [["je m'appelle…", "/ʒə ma.pɛl/", "我叫……", "my name is…"], ["je viens de…", "/ʒə vjɛ̃ də/", "我来自……", "I come from…"], ["oui", "/wi/", "是；好的", "yes"], ["non", "/nɔ̃/", "不；不是", "no"]],
    [["aéroport", "/a.e.ʁɔ.pɔʁ/", "机场", "airport"], ["billet", "/bi.jɛ/", "票", "ticket"], ["porte", "/pɔʁt/", "登机口；门", "gate; door"], ["où est… ?", "/u ɛ/", "……在哪里？", "where is…?"]],
    [["à gauche", "/a ɡoʃ/", "左边", "to the left"], ["à droite", "/a dʁwat/", "右边", "to the right"], ["tout droit", "/tu dʁwa/", "一直往前", "straight ahead"], ["toilettes", "/twa.lɛt/", "洗手间", "restroom"]],
    [["menu", "/mə.ny/", "菜单", "menu"], ["eau", "/o/", "水", "water"], ["végétarien", "/ve.ʒe.ta.ʁjɛ̃/", "素食的；素食者", "vegetarian"], ["l'addition, s'il vous plaît", "/la.di.sjɔ̃ sil vu plɛ/", "请结账", "the bill, please"]],
    [["combien ça coûte ?", "/kɔ̃.bjɛ̃ sa kut/", "多少钱？", "how much does it cost?"], ["espèces", "/ɛs.pɛs/", "现金", "cash"], ["carte", "/kaʁt/", "银行卡；卡", "card"], ["reçu", "/ʁə.sy/", "收据", "receipt"]],
    [["au secours !", "/o sə.kuʁ/", "救命！", "help!"], ["je suis perdu", "/ʒə sɥi pɛʁ.dy/", "我迷路了", "I am lost"], ["médecin", "/med.sɛ̃/", "医生", "doctor"], ["police", "/pɔ.lis/", "警察", "police"]],
  ],
  de: [
    [["Hallo", "/ˈhaloː/", "你好", "hello"], ["bitte", "/ˈbɪtə/", "请；不客气", "please; you're welcome"], ["danke", "/ˈdaŋkə/", "谢谢", "thank you"], ["Entschuldigung", "/ɛntˈʃʊldɪɡʊŋ/", "劳驾；对不起", "excuse me; sorry"]],
    [["ich heiße…", "/ɪç ˈhaɪsə/", "我叫……", "my name is…"], ["ich komme aus…", "/ɪç ˈkɔmə aʊs/", "我来自……", "I come from…"], ["ja", "/jaː/", "是；好的", "yes"], ["nein", "/naɪn/", "不；不是", "no"]],
    [["Flughafen", "/ˈfluːkˌhaːfn̩/", "机场", "airport"], ["Fahrkarte", "/ˈfaːɐ̯ˌkaʁtə/", "车票", "ticket"], ["Flugsteig", "/ˈfluːkˌʃtaɪk/", "登机口", "boarding gate"], ["wo ist…?", "/voː ɪst/", "……在哪里？", "where is…?"]],
    [["links", "/lɪŋks/", "左边", "left"], ["rechts", "/ʁɛçts/", "右边", "right"], ["geradeaus", "/ɡəˈʁaːdəˌʔaʊs/", "一直往前", "straight ahead"], ["Toilette", "/toaˈlɛtə/", "洗手间", "restroom"]],
    [["Speisekarte", "/ˈʃpaɪzəˌkaʁtə/", "菜单", "menu"], ["Wasser", "/ˈvasɐ/", "水", "water"], ["vegetarisch", "/veɡeˈtaːʁɪʃ/", "素食的", "vegetarian"], ["die Rechnung, bitte", "/diː ˈʁɛçnʊŋ ˈbɪtə/", "请结账", "the bill, please"]],
    [["wie viel kostet das?", "/viː fiːl ˈkɔstət das/", "多少钱？", "how much does that cost?"], ["Bargeld", "/ˈbaːɐ̯ˌɡɛlt/", "现金", "cash"], ["Karte", "/ˈkaʁtə/", "银行卡；卡", "card"], ["Quittung", "/ˈkvɪtʊŋ/", "收据", "receipt"]],
    [["Hilfe!", "/ˈhɪlfə/", "救命；请帮忙", "help!"], ["ich habe mich verlaufen", "/ɪç ˈhaːbə mɪç fɛɐ̯ˈlaʊfn̩/", "我迷路了", "I am lost"], ["Arzt", "/aːɐ̯tst/", "医生", "doctor"], ["Polizei", "/poliˈtsaɪ/", "警察", "police"]],
  ],
  it: [
    [["ciao", "/ˈtʃa.o/", "你好；再见（非正式）", "hello; goodbye (informal)"], ["per favore", "/per faˈvo.re/", "请", "please"], ["grazie", "/ˈɡrat.tsje/", "谢谢", "thank you"], ["mi scusi", "/mi ˈsku.zi/", "劳驾；对不起", "excuse me"]],
    [["mi chiamo…", "/mi ˈkja.mo/", "我叫……", "my name is…"], ["vengo da…", "/ˈvɛŋ.ɡo da/", "我来自……", "I come from…"], ["sì", "/si/", "是；好的", "yes"], ["no", "/no/", "不；不是", "no"]],
    [["aeroporto", "/a.e.roˈpɔr.to/", "机场", "airport"], ["biglietto", "/biʎˈʎet.to/", "票", "ticket"], ["uscita", "/ˈu.ʃi.ta/", "出口", "exit"], ["dov'è…?", "/doˈvɛ/", "……在哪里？", "where is…?"]],
    [["a sinistra", "/a siˈni.stra/", "左边", "to the left"], ["a destra", "/a ˈde.stra/", "右边", "to the right"], ["sempre dritto", "/ˈsɛm.pre ˈdrit.to/", "一直往前", "straight ahead"], ["bagno", "/ˈbaɲ.ɲo/", "洗手间", "restroom"]],
    [["menù", "/meˈnu/", "菜单", "menu"], ["acqua", "/ˈak.kwa/", "水", "water"], ["vegetariano", "/ve.dʒe.taˈrja.no/", "素食的；素食者", "vegetarian"], ["il conto, per favore", "/il ˈkon.to per faˈvo.re/", "请结账", "the bill, please"]],
    [["quanto costa?", "/ˈkwan.to ˈkɔ.sta/", "多少钱？", "how much does it cost?"], ["contanti", "/konˈtan.ti/", "现金", "cash"], ["carta", "/ˈkar.ta/", "银行卡；卡", "card"], ["ricevuta", "/ri.tʃeˈvu.ta/", "收据", "receipt"]],
    [["aiuto!", "/aˈju.to/", "救命；请帮忙", "help!"], ["mi sono perso", "/mi ˈso.no ˈpɛr.so/", "我迷路了", "I am lost"], ["medico", "/ˈmɛ.di.ko/", "医生", "doctor"], ["polizia", "/po.liˈtsi.a/", "警察", "police"]],
  ],
  pt: [
    [["olá", "/oˈla/", "你好", "hello"], ["por favor", "/poɾ faˈvoɾ/", "请", "please"], ["obrigado", "/obɾiˈɡadu/", "谢谢", "thank you"], ["com licença", "/kõ liˈsẽsɐ/", "劳驾", "excuse me"]],
    [["chamo-me…", "/ˈʃamu mə/", "我叫……", "my name is…"], ["sou de…", "/so dɨ/", "我来自……", "I am from…"], ["sim", "/sĩ/", "是；好的", "yes"], ["não", "/nɐ̃w̃/", "不；不是", "no"]],
    [["aeroporto", "/aɛɾuˈpɔɾtu/", "机场", "airport"], ["bilhete", "/biˈʎɛtɨ/", "票", "ticket"], ["porta", "/ˈpɔɾtɐ/", "登机口；门", "gate; door"], ["onde fica…?", "/ˈõdɨ ˈfikɐ/", "……在哪里？", "where is…?"]],
    [["à esquerda", "/a ɨʃˈkɛɾdɐ/", "左边", "to the left"], ["à direita", "/a diˈɾɐjtɐ/", "右边", "to the right"], ["sempre em frente", "/ˈsẽpɾɨ ẽ ˈfɾẽtɨ/", "一直往前", "straight ahead"], ["casa de banho", "/ˈkazɐ dɨ ˈbɐɲu/", "洗手间", "restroom"]],
    [["menu", "/mɨˈnu/", "菜单", "menu"], ["água", "/ˈaɡwɐ/", "水", "water"], ["vegetariano", "/vɨʒɨtɐɾiˈɐnu/", "素食的；素食者", "vegetarian"], ["a conta, por favor", "/ɐ ˈkõtɐ poɾ faˈvoɾ/", "请结账", "the bill, please"]],
    [["quanto custa?", "/ˈkwɐ̃tu ˈkuʃtɐ/", "多少钱？", "how much does it cost?"], ["dinheiro", "/diˈɲɐjɾu/", "现金；钱", "cash; money"], ["cartão", "/kɐɾˈtɐ̃w̃/", "银行卡", "card"], ["recibo", "/ʁɨˈsibu/", "收据", "receipt"]],
    [["socorro!", "/suˈkoʁu/", "救命！", "help!"], ["estou perdido", "/ɨʃˈto pɨɾˈdidu/", "我迷路了", "I am lost"], ["médico", "/ˈmɛdiku/", "医生", "doctor"], ["polícia", "/puˈlisjɐ/", "警察", "police"]],
  ],
  ja: [
    [["こんにちは", "konnichiwa", "你好；日安", "hello; good afternoon"], ["お願いします", "onegai shimasu", "请；拜托了", "please"], ["ありがとうございます", "arigatō gozaimasu", "谢谢", "thank you"], ["すみません", "sumimasen", "劳驾；对不起", "excuse me; sorry"]],
    [["私は……です", "watashi wa… desu", "我是……", "I am…"], ["……から来ました", "…kara kimashita", "我来自……", "I came from…"], ["はい", "hai", "是；好的", "yes"], ["いいえ", "iie", "不；不是", "no"]],
    [["空港", "kūkō", "机场", "airport"], ["切符", "kippu", "票", "ticket"], ["搭乗口", "tōjōguchi", "登机口", "boarding gate"], ["……はどこですか？", "…wa doko desu ka", "……在哪里？", "where is…?"]],
    [["左", "hidari", "左边", "left"], ["右", "migi", "右边", "right"], ["まっすぐ", "massugu", "一直往前", "straight ahead"], ["トイレ", "toire", "洗手间", "restroom"]],
    [["メニュー", "menyū", "菜单", "menu"], ["水", "mizu", "水", "water"], ["ベジタリアン", "bejitarian", "素食者", "vegetarian"], ["お会計をお願いします", "okaikei o onegai shimasu", "请结账", "the bill, please"]],
    [["いくらですか？", "ikura desu ka", "多少钱？", "how much?"], ["現金", "genkin", "现金", "cash"], ["カード", "kādo", "银行卡；卡", "card"], ["レシート", "reshīto", "收据", "receipt"]],
    [["助けて！", "tasukete", "救命；请帮忙", "help!"], ["道に迷いました", "michi ni mayoimashita", "我迷路了", "I am lost"], ["医者", "isha", "医生", "doctor"], ["警察", "keisatsu", "警察", "police"]],
  ],
  ko: [
    [["안녕하세요", "annyeonghaseyo", "你好", "hello"], ["부탁합니다", "butakhamnida", "请；拜托了", "please"], ["감사합니다", "gamsahamnida", "谢谢", "thank you"], ["실례합니다", "sillyehamnida", "劳驾；失礼了", "excuse me"]],
    [["제 이름은 …입니다", "je ireumeun… imnida", "我的名字是……", "my name is…"], ["저는 …에서 왔어요", "jeoneun… eseo wasseoyo", "我来自……", "I am from…"], ["네", "ne", "是；好的", "yes"], ["아니요", "aniyo", "不；不是", "no"]],
    [["공항", "gonghang", "机场", "airport"], ["표", "pyo", "票", "ticket"], ["탑승구", "tapseunggu", "登机口", "boarding gate"], ["…은 어디예요?", "…eun eodiyeyo", "……在哪里？", "where is…?"]],
    [["왼쪽", "oenjjok", "左边", "left"], ["오른쪽", "oreunjjok", "右边", "right"], ["쭉 가세요", "jjuk gaseyo", "一直往前", "go straight"], ["화장실", "hwajangsil", "洗手间", "restroom"]],
    [["메뉴", "menyu", "菜单", "menu"], ["물", "mul", "水", "water"], ["채식", "chaesik", "素食", "vegetarian food"], ["계산해 주세요", "gyesanhae juseyo", "请结账", "the bill, please"]],
    [["얼마예요?", "eolmayeyo", "多少钱？", "how much?"], ["현금", "hyeongeum", "现金", "cash"], ["카드", "kadeu", "银行卡；卡", "card"], ["영수증", "yeongsujeung", "收据", "receipt"]],
    [["도와주세요!", "dowajuseyo", "请帮帮我", "help me!"], ["길을 잃었어요", "gireul ireosseoyo", "我迷路了", "I am lost"], ["의사", "uisa", "医生", "doctor"], ["경찰", "gyeongchal", "警察", "police"]],
  ],
  ru: [
    [["здравствуйте", "zdravstvuyte", "您好", "hello (formal)"], ["пожалуйста", "pozhaluysta", "请；不客气", "please; you're welcome"], ["спасибо", "spasibo", "谢谢", "thank you"], ["извините", "izvinite", "劳驾；对不起", "excuse me; sorry"]],
    [["меня зовут…", "menya zovut", "我叫……", "my name is…"], ["я из…", "ya iz", "我来自……", "I am from…"], ["да", "da", "是；好的", "yes"], ["нет", "net", "不；不是", "no"]],
    [["аэропорт", "aeroport", "机场", "airport"], ["билет", "bilet", "票", "ticket"], ["выход", "vykhod", "出口；登机口", "exit; gate"], ["где…?", "gde", "……在哪里？", "where is…?"]],
    [["налево", "nalevo", "向左", "to the left"], ["направо", "napravo", "向右", "to the right"], ["прямо", "pryamo", "一直往前", "straight ahead"], ["туалет", "tualet", "洗手间", "restroom"]],
    [["меню", "menyu", "菜单", "menu"], ["вода", "voda", "水", "water"], ["вегетарианский", "vegetarianskiy", "素食的", "vegetarian"], ["счёт, пожалуйста", "schyot pozhaluysta", "请结账", "the bill, please"]],
    [["сколько стоит?", "skolko stoit", "多少钱？", "how much does it cost?"], ["наличные", "nalichnye", "现金", "cash"], ["карта", "karta", "银行卡；卡", "card"], ["чек", "chek", "收据", "receipt"]],
    [["помогите!", "pomogite", "救命；请帮忙", "help!"], ["я заблудился", "ya zabludilsya", "我迷路了", "I am lost"], ["врач", "vrach", "医生", "doctor"], ["полиция", "politsiya", "警察", "police"]],
  ],
  ar: [
    [["مرحبًا", "marḥaban", "你好", "hello"], ["من فضلك", "min faḍlik", "请", "please"], ["شكرًا", "shukran", "谢谢", "thank you"], ["عذرًا", "ʿudhran", "劳驾；对不起", "excuse me; sorry"]],
    [["اسمي…", "ismī", "我的名字是……", "my name is…"], ["أنا من…", "anā min", "我来自……", "I am from…"], ["نعم", "naʿam", "是；好的", "yes"], ["لا", "lā", "不；不是", "no"]],
    [["مطار", "maṭār", "机场", "airport"], ["تذكرة", "tadhkira", "票", "ticket"], ["بوابة", "bawwāba", "登机口；门", "gate"], ["أين…؟", "ayna", "……在哪里？", "where is…?"]],
    [["يسار", "yasār", "左边", "left"], ["يمين", "yamīn", "右边", "right"], ["إلى الأمام", "ilā al-amām", "一直往前", "straight ahead"], ["دورة المياه", "dawrat al-miyāh", "洗手间", "restroom"]],
    [["قائمة الطعام", "qāʾimat al-ṭaʿām", "菜单", "menu"], ["ماء", "māʾ", "水", "water"], ["نباتي", "nabātī", "素食的；素食者", "vegetarian"], ["الحساب من فضلك", "al-ḥisāb min faḍlik", "请结账", "the bill, please"]],
    [["كم السعر؟", "kam al-siʿr", "多少钱？", "how much?"], ["نقدًا", "naqdan", "现金", "cash"], ["بطاقة", "biṭāqa", "银行卡；卡", "card"], ["إيصال", "īṣāl", "收据", "receipt"]],
    [["النجدة!", "al-najda", "救命！", "help!"], ["أنا تائه", "anā tāʾih", "我迷路了", "I am lost"], ["طبيب", "ṭabīb", "医生", "doctor"], ["شرطة", "shurṭa", "警察", "police"]],
  ],
  hi: [
    [["नमस्ते", "namaste", "你好", "hello"], ["कृपया", "kṛpayā", "请", "please"], ["धन्यवाद", "dhanyavād", "谢谢", "thank you"], ["माफ़ कीजिए", "māf kījie", "劳驾；对不起", "excuse me; sorry"]],
    [["मेरा नाम … है", "merā nām… hai", "我的名字是……", "my name is…"], ["मैं … से हूँ", "maiṃ… se hūṃ", "我来自……", "I am from…"], ["हाँ", "hāṃ", "是；好的", "yes"], ["नहीं", "nahīṃ", "不；不是", "no"]],
    [["हवाई अड्डा", "havāī aḍḍā", "机场", "airport"], ["टिकट", "ṭikaṭ", "票", "ticket"], ["गेट", "geṭ", "登机口；门", "gate"], ["… कहाँ है?", "… kahāṃ hai", "……在哪里？", "where is…?"]],
    [["बाएँ", "bāẽ", "左边", "left"], ["दाएँ", "dāẽ", "右边", "right"], ["सीधे", "sīdhe", "一直往前", "straight ahead"], ["शौचालय", "śaucālay", "洗手间", "restroom"]],
    [["मेन्यू", "menyū", "菜单", "menu"], ["पानी", "pānī", "水", "water"], ["शाकाहारी", "śākāhārī", "素食的；素食者", "vegetarian"], ["बिल दीजिए", "bil dījie", "请结账", "the bill, please"]],
    [["कितने का है?", "kitne kā hai", "多少钱？", "how much?"], ["नकद", "nakad", "现金", "cash"], ["कार्ड", "kārḍ", "银行卡；卡", "card"], ["रसीद", "rasīd", "收据", "receipt"]],
    [["मदद!", "madad", "救命；请帮忙", "help!"], ["मैं रास्ता भूल गया", "maiṃ rāstā bhūl gayā", "我迷路了", "I am lost"], ["डॉक्टर", "ḍŏkṭar", "医生", "doctor"], ["पुलिस", "pulis", "警察", "police"]],
  ],
} as const satisfies Record<SmartLingoCommunityLanguage, SevenDayVocabularySeed>;

export function beginnerVocabularySceneForDay(day: number): SmartLingoBeginnerScene {
  const normalized = Math.max(1, Math.min(7, Math.trunc(day || 1)));
  return SMARTLINGO_BEGINNER_SCENES[normalized - 1];
}

export function beginnerVocabularySeedsForDay(language: SmartLingoCommunityLanguage, day: number) {
  const normalized = Math.max(1, Math.min(7, Math.trunc(day || 1)));
  return SMARTLINGO_BEGINNER_VOCABULARY_SEEDS[language][normalized - 1];
}
