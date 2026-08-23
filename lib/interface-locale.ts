import { SMARTLINGO_LANGUAGE_COMMUNITIES, type SmartLingoCommunityLanguage } from "./smartlingo-language-communities";
import { homeInterfaceTranslations } from "./home-interface-translations.generated";

export type InterfaceLanguage = SmartLingoCommunityLanguage;
export const interfaceLanguages = SMARTLINGO_LANGUAGE_COMMUNITIES;
export const interfaceLanguageCodes = new Set<string>(interfaceLanguages.map(({ code }) => code));
export const isInterfaceLanguage = (value: string): value is InterfaceLanguage => interfaceLanguageCodes.has(value);
export const safeInterfaceLanguage = (value: string): InterfaceLanguage => isInterfaceLanguage(value) ? value : "en";

type InterfaceCopy = {
  everyday:string; play:string; courses:string; colleges:string; askAi:string;
  primaryNav:string; openMenu:string; closeMenu:string; home:string; language:string;
  chooseLanguage:string; footerNav:string; footerTagline:string; project:string; about:string;
  privacy:string; terms:string; askGuru:string; account:string; signIn:string;
  openSprint:string; startSprint:string; browseCourses:string; myCourses:string;
  chooseLanguageAction:string; viewPaths:string; communityArtAlt:string;
};

const en: InterfaceCopy = { everyday:"Everyday speaking",play:"Learn through play",courses:"Choose course",colleges:"Choose College",askAi:"Ask AI",primaryNav:"Primary navigation",openMenu:"Open menu",closeMenu:"Close menu",home:"SmartLingo home",language:"Language",chooseLanguage:"Choose a language",footerNav:"Footer navigation",footerTagline:"Speak from day one · AI Guru · Three course levels · First month free",project:"Project",about:"About",privacy:"Privacy",terms:"Terms",askGuru:"Ask Guru",account:"Account menu",signIn:"Sign in",openSprint:"Open Today’s Sprint and choose a language and time",startSprint:"Start Today’s Sprint",browseCourses:"Browse Courses",myCourses:"My Courses",chooseLanguageAction:"Choose language",viewPaths:"View learning paths",communityArtAlt:"Learners from different backgrounds practicing language together with an AI voice coach" };
export const interfaceCopies: Record<InterfaceLanguage, InterfaceCopy> = {
  en,
  zh:{everyday:"生活口语",play:"边玩边学",courses:"选择课程",colleges:"选择学院",askAi:"咨询AI",primaryNav:"主导航",openMenu:"打开菜单",closeMenu:"关闭菜单",home:"SmartLingo 首页",language:"语言",chooseLanguage:"选择语言",footerNav:"页脚导航",footerTagline:"从第一天开口 · 人工智能导师 · 三级课程 · 首月免费",project:"项目",about:"关于我们",privacy:"隐私政策",terms:"使用条款",askGuru:"咨询专家",account:"账户菜单",signIn:"登录",openSprint:"打开今日速成，选择语言和时长",startSprint:"开始今日速成",browseCourses:"浏览课程",myCourses:"我的课程",chooseLanguageAction:"选择语言",viewPaths:"查看学习路径",communityArtAlt:"来自不同背景的学习者在人工智能语音导师帮助下共同练习语言"},
  ja:{...en,everyday:"日常会話",play:"遊んで学ぶ",courses:"コースを選ぶ",colleges:"カレッジを選ぶ",askAi:"AIに相談",primaryNav:"メインナビゲーション",openMenu:"メニューを開く",closeMenu:"メニューを閉じる",home:"SmartLingo ホーム",language:"言語",chooseLanguage:"言語を選択",footerNav:"フッターナビゲーション",footerTagline:"初日から話す · AI講師 · 3段階のコース · 初月無料",project:"プロジェクト",about:"SmartLingoについて",privacy:"プライバシーポリシー",terms:"利用規約",askGuru:"AI講師に相談",account:"アカウントメニュー",signIn:"ログイン",openSprint:"今日の速習を開き、言語と時間を選択",startSprint:"今日の速習を開始",browseCourses:"コースを見る",myCourses:"マイコース",chooseLanguageAction:"言語を選ぶ",viewPaths:"学習パスを見る",communityArtAlt:"さまざまな背景の学習者がAI音声コーチと一緒に言語を練習している様子"},
  ko:{...en,everyday:"생활 회화",play:"놀면서 배우기",courses:"과정 선택",colleges:"칼리지 선택",askAi:"AI에게 질문",primaryNav:"주요 탐색",openMenu:"메뉴 열기",closeMenu:"메뉴 닫기",home:"SmartLingo 홈",language:"언어",chooseLanguage:"언어 선택",footerNav:"바닥글 탐색",footerTagline:"첫날부터 말하기 · AI 강사 · 3단계 과정 · 첫 달 무료",project:"프로젝트",about:"SmartLingo 소개",privacy:"개인정보 처리방침",terms:"이용약관",askGuru:"AI 강사에게 질문",account:"계정 메뉴",signIn:"로그인",openSprint:"오늘의 속성 학습을 열고 언어와 시간을 선택",startSprint:"오늘의 속성 학습 시작",browseCourses:"과정 둘러보기",myCourses:"내 과정",chooseLanguageAction:"언어 선택",viewPaths:"학습 경로 보기",communityArtAlt:"다양한 배경의 학습자들이 AI 음성 코치와 함께 언어를 연습하는 모습"},
  es:{...en,everyday:"Conversación cotidiana",play:"Aprender jugando",courses:"Elegir curso",colleges:"Elegir academia",askAi:"Preguntar a la IA",primaryNav:"Navegación principal",openMenu:"Abrir menú",closeMenu:"Cerrar menú",home:"Inicio de SmartLingo",language:"Idioma",chooseLanguage:"Elegir idioma",footerNav:"Navegación del pie",footerTagline:"Habla desde el primer día · Tutor de IA · Tres niveles · Primer mes gratis",project:"Proyecto",about:"Acerca de",privacy:"Privacidad",terms:"Términos",askGuru:"Preguntar al tutor",account:"Menú de cuenta",signIn:"Acceder"},
  fr:{...en,everyday:"Conversation quotidienne",play:"Apprendre en jouant",courses:"Choisir un cours",colleges:"Choisir une académie",askAi:"Demander à l’IA",primaryNav:"Navigation principale",openMenu:"Ouvrir le menu",closeMenu:"Fermer le menu",home:"Accueil SmartLingo",language:"Langue",chooseLanguage:"Choisir la langue",footerNav:"Navigation du pied",footerTagline:"Parlez dès le premier jour · Tuteur IA · Trois niveaux · Premier mois gratuit",project:"Projet",about:"À propos",privacy:"Confidentialité",terms:"Conditions",askGuru:"Demander au tuteur",account:"Menu du compte",signIn:"Connexion"},
  de:{...en,everyday:"Alltagsgespräche",play:"Spielend lernen",courses:"Kurs wählen",colleges:"Akademie wählen",askAi:"KI fragen",primaryNav:"Hauptnavigation",openMenu:"Menü öffnen",closeMenu:"Menü schließen",home:"SmartLingo Startseite",language:"Sprache",chooseLanguage:"Sprache wählen",footerNav:"Fußzeilennavigation",footerTagline:"Vom ersten Tag an sprechen · KI-Tutor · Drei Kursstufen · Erster Monat kostenlos",project:"Projekt",about:"Über uns",privacy:"Datenschutz",terms:"Bedingungen",askGuru:"Tutor fragen",account:"Kontomenü",signIn:"Anmelden"},
  ru:{...en,everyday:"Разговорная практика",play:"Учиться играя",courses:"Выбрать курс",colleges:"Выбрать академию",askAi:"Спросить ИИ",primaryNav:"Основная навигация",openMenu:"Открыть меню",closeMenu:"Закрыть меню",home:"Главная SmartLingo",language:"Язык",chooseLanguage:"Выбрать язык",footerNav:"Навигация внизу",footerTagline:"Говорите с первого дня · ИИ-наставник · Три уровня · Первый месяц бесплатно",project:"Проект",about:"О нас",privacy:"Конфиденциальность",terms:"Условия",askGuru:"Спросить наставника",account:"Меню аккаунта",signIn:"Войти"},
  it:{...en,everyday:"Conversazione quotidiana",play:"Impara giocando",courses:"Scegli corso",colleges:"Scegli accademia",askAi:"Chiedi all’IA",primaryNav:"Navigazione principale",openMenu:"Apri menu",closeMenu:"Chiudi menu",home:"Home SmartLingo",language:"Lingua",chooseLanguage:"Scegli lingua",footerNav:"Navigazione piè di pagina",footerTagline:"Parla dal primo giorno · Tutor IA · Tre livelli · Primo mese gratuito",project:"Progetto",about:"Chi siamo",privacy:"Privacy",terms:"Termini",askGuru:"Chiedi al tutor",account:"Menu account",signIn:"Accedi"},
  pt:{...en,everyday:"Conversação diária",play:"Aprender jogando",courses:"Escolher curso",colleges:"Escolher academia",askAi:"Perguntar à IA",primaryNav:"Navegação principal",openMenu:"Abrir menu",closeMenu:"Fechar menu",home:"Início SmartLingo",language:"Idioma",chooseLanguage:"Escolher idioma",footerNav:"Navegação do rodapé",footerTagline:"Fale desde o primeiro dia · Tutor de IA · Três níveis · Primeiro mês grátis",project:"Projeto",about:"Sobre",privacy:"Privacidade",terms:"Termos",askGuru:"Perguntar ao tutor",account:"Menu da conta",signIn:"Entrar"},
  ar:{...en,everyday:"محادثات يومية",play:"تعلّم باللعب",courses:"اختر دورة",colleges:"اختر أكاديمية",askAi:"اسأل الذكاء الاصطناعي",primaryNav:"التنقل الرئيسي",openMenu:"فتح القائمة",closeMenu:"إغلاق القائمة",home:"الصفحة الرئيسية لـ SmartLingo",language:"اللغة",chooseLanguage:"اختر اللغة",footerNav:"تنقل التذييل",footerTagline:"تحدث من اليوم الأول · معلّم ذكي · ثلاثة مستويات · الشهر الأول مجانًا",project:"المشروع",about:"من نحن",privacy:"الخصوصية",terms:"الشروط",askGuru:"اسأل المعلّم",account:"قائمة الحساب",signIn:"تسجيل الدخول"},
  hi:{...en,everyday:"दैनिक बातचीत",play:"खेलते हुए सीखें",courses:"पाठ्यक्रम चुनें",colleges:"अकादमी चुनें",askAi:"AI से पूछें",primaryNav:"मुख्य नेविगेशन",openMenu:"मेनू खोलें",closeMenu:"मेनू बंद करें",home:"SmartLingo होम",language:"भाषा",chooseLanguage:"भाषा चुनें",footerNav:"फुटर नेविगेशन",footerTagline:"पहले दिन से बोलें · AI शिक्षक · तीन स्तर · पहला महीना मुफ़्त",project:"परियोजना",about:"हमारे बारे में",privacy:"गोपनीयता",terms:"शर्तें",askGuru:"शिक्षक से पूछें",account:"खाता मेनू",signIn:"साइन इन"},
};
export const interfaceCopyFor = (language: InterfaceLanguage) => interfaceCopies[language];

type AssistantComposerCopy = { question:string; placeholder:string; faq:string; startVoice:string; stopVoice:string; send:string };
export const assistantComposerCopy: Record<InterfaceLanguage, AssistantComposerCopy> = {
  en:{question:"Your question",placeholder:"Message Guru…",faq:"Frequently asked questions",startVoice:"Start voice input",stopVoice:"Stop voice input",send:"Send message"},
  zh:{question:"输入问题",placeholder:"给智能导师发消息…",faq:"常见问题",startVoice:"开始语音输入",stopVoice:"停止语音输入",send:"发送消息"},
  ja:{question:"質問を入力",placeholder:"AI講師にメッセージ…",faq:"よくある質問",startVoice:"音声入力を開始",stopVoice:"音声入力を停止",send:"メッセージを送信"},
  ko:{question:"질문 입력",placeholder:"AI 강사에게 메시지…",faq:"자주 묻는 질문",startVoice:"음성 입력 시작",stopVoice:"음성 입력 중지",send:"메시지 보내기"},
  es:{question:"Escribe tu pregunta",placeholder:"Escribe al tutor de IA…",faq:"Preguntas frecuentes",startVoice:"Iniciar entrada de voz",stopVoice:"Detener entrada de voz",send:"Enviar mensaje"},
  fr:{question:"Saisissez votre question",placeholder:"Écrire au tuteur IA…",faq:"Questions fréquentes",startVoice:"Démarrer la saisie vocale",stopVoice:"Arrêter la saisie vocale",send:"Envoyer le message"},
  de:{question:"Frage eingeben",placeholder:"Dem KI-Tutor schreiben…",faq:"Häufige Fragen",startVoice:"Spracheingabe starten",stopVoice:"Spracheingabe stoppen",send:"Nachricht senden"},
  ru:{question:"Введите вопрос",placeholder:"Написать ИИ-наставнику…",faq:"Частые вопросы",startVoice:"Начать голосовой ввод",stopVoice:"Остановить голосовой ввод",send:"Отправить сообщение"},
  it:{question:"Inserisci la domanda",placeholder:"Scrivi al tutor IA…",faq:"Domande frequenti",startVoice:"Avvia input vocale",stopVoice:"Interrompi input vocale",send:"Invia messaggio"},
  pt:{question:"Digite sua pergunta",placeholder:"Escreva ao tutor de IA…",faq:"Perguntas frequentes",startVoice:"Iniciar entrada de voz",stopVoice:"Parar entrada de voz",send:"Enviar mensagem"},
  ar:{question:"أدخل سؤالك",placeholder:"اكتب إلى معلّم الذكاء الاصطناعي…",faq:"الأسئلة الشائعة",startVoice:"بدء الإدخال الصوتي",stopVoice:"إيقاف الإدخال الصوتي",send:"إرسال الرسالة"},
  hi:{question:"अपना प्रश्न लिखें",placeholder:"AI शिक्षक को संदेश लिखें…",faq:"अक्सर पूछे जाने वाले प्रश्न",startVoice:"आवाज़ इनपुट शुरू करें",stopVoice:"आवाज़ इनपुट रोकें",send:"संदेश भेजें"},
};

export function interfaceText(language: InterfaceLanguage, english: string, chinese: string) {
  if (language === "zh") return chinese;
  if (language === "en") return english;
  return homeInterfaceTranslations[language]?.[english] ?? english;
}

export function translateHomeCopy<T>(value: T, language: InterfaceLanguage, translations: Record<string, Record<string,string>>): T {
  if (language === "en") return value;
  const dictionary = translations[language];
  if (!dictionary) return value;
  if (typeof value === "string") return (dictionary[value] ?? value) as T;
  if (Array.isArray(value)) return value.map(item => translateHomeCopy(item, language, translations)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, translateHomeCopy(item, language, translations)])) as T;
  return value;
}
