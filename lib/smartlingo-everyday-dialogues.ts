import type { SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";
import { buildCourseSentenceBank } from "./smartlingo-sentence-exercises.ts";

export type EverydayDialogueRole = "staff" | "learner";

export type EverydayDialogueLine = {
  role: EverydayDialogueRole;
  target: string;
  meaningZh: string;
  meaningEn: string;
  pairIndex: number;
};

type BasePair = readonly [questionEn: string, answerEn: string, questionZh: string, answerZh: string];
type Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): ReturnType<Database["prepare"]>;
    first<T>(): Promise<T | null>;
    run<T = Record<string, unknown>>(): Promise<{ results?: T[]; success?: boolean }>;
  };
};

/**
 * Human-authored task briefs are the durable semantic source. Target-language
 * lines are release-stamped and cached after Luna localization, so media and
 * teaching intent stay stable while every supported language gets natural text.
 */
export const SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS: Record<string, readonly BasePair[]> = {
  airport: [
    ["May I see your passport?", "Yes, here is my passport.", "可以看一下您的护照吗？", "可以，这是我的护照。"],
    ["Where are you flying today?", "I am flying to Rome.", "您今天飞往哪里？", "我今天飞往罗马。"],
    ["Do you have a bag to check?", "Yes, I have one suitcase.", "您有行李要托运吗？", "有，我有一个行李箱。"],
    ["Would you like a window or aisle seat?", "A window seat, please.", "您想要靠窗还是靠过道的座位？", "请给我靠窗的座位。"],
    ["Do you know your gate number?", "No. Which gate should I use?", "您知道登机口号码吗？", "不知道，我应该去哪个登机口？"],
    ["Your gate has changed. Do you need directions?", "Yes, please show me the new gate.", "您的登机口变了，需要指路吗？", "需要，请告诉我新登机口怎么走。"],
    ["Is your flight on time?", "It is delayed by thirty minutes.", "您的航班准时吗？", "航班晚点三十分钟。"],
    ["Did you pack this bag yourself?", "Yes, I packed it myself.", "这个包是您自己收拾的吗？", "是的，是我自己收拾的。"],
    ["Would you like help finding security?", "Yes. Where is the security checkpoint?", "需要帮您找安检吗？", "需要，请问安检口在哪里？"],
    ["Do you need anything else before boarding?", "No, thank you. I am ready to board.", "登机前还需要什么吗？", "不需要了，谢谢，我准备登机了。"],
  ],
  hotel: [
    ["Welcome. Do you have a reservation?", "Yes, the reservation is under Lee.", "欢迎光临，您有预订吗？", "有，预订姓名是李。"],
    ["May I see your identification?", "Of course. Here it is.", "可以看一下您的证件吗？", "当然可以，给您。"],
    ["How many nights will you stay?", "I will stay for three nights.", "您要住几个晚上？", "我要住三个晚上。"],
    ["Would you like one key or two?", "Two keys, please.", "您需要一张房卡还是两张？", "请给我两张房卡。"],
    ["Do you need breakfast tomorrow?", "Yes. What time does breakfast start?", "明天需要早餐吗？", "需要，早餐几点开始？"],
    ["Is the room comfortable?", "Yes, but I need another towel.", "房间住得舒服吗？", "很舒服，不过我还需要一条毛巾。"],
    ["Can I help with the air conditioner?", "Yes, the room is too warm.", "需要我帮您调空调吗？", "需要，房间太热了。"],
    ["Would you like a wake-up call?", "Yes, please call me at six.", "需要叫醒服务吗？", "需要，请六点叫醒我。"],
    ["Do you need a taxi to the airport?", "Yes, please book one for seven.", "需要出租车去机场吗？", "需要，请帮我预订七点的车。"],
    ["Are you ready to check out?", "Yes. May I have the receipt?", "您准备退房了吗？", "准备好了，可以给我收据吗？"],
  ],
  restaurant: [
    ["How many people are in your party?", "A table for two, please.", "请问几位？", "两位，谢谢。"],
    ["Would you like to see the menu?", "Yes, please. Do you have an English menu?", "需要看菜单吗？", "需要，请问有英文菜单吗？"],
    ["Are you ready to order?", "Yes, I would like the chicken.", "可以点餐了吗？", "可以，我想要鸡肉。"],
    ["Would you like rice or potatoes?", "Rice, please.", "您想配米饭还是土豆？", "请配米饭。"],
    ["How spicy would you like it?", "Not spicy, please.", "您想要多辣？", "请不要辣。"],
    ["Do you have any food allergies?", "Yes, I am allergic to peanuts.", "您有食物过敏吗？", "有，我对花生过敏。"],
    ["Would you like something to drink?", "Water without ice, please.", "想喝点什么吗？", "请给我不加冰的水。"],
    ["How is your meal?", "It is delicious, thank you.", "餐点怎么样？", "很好吃，谢谢。"],
    ["Would you like dessert?", "No, thank you. Just the bill.", "需要甜点吗？", "不用，谢谢，请结账。"],
    ["Will you pay together or separately?", "Together by card, please.", "一起付还是分开付？", "一起付，请刷卡。"],
  ],
  hospital: [
    ["How can I help you today?", "I need to see a doctor.", "今天哪里需要帮助？", "我需要看医生。"],
    ["What symptoms do you have?", "I have a fever and a cough.", "您有什么症状？", "我发烧并且咳嗽。"],
    ["When did the symptoms start?", "They started yesterday evening.", "症状什么时候开始的？", "昨天晚上开始的。"],
    ["How strong is the pain from one to ten?", "It is about six.", "疼痛从一到十有多严重？", "大约六级。"],
    ["Do you have any allergies?", "Yes, I am allergic to penicillin.", "您有过敏吗？", "有，我对青霉素过敏。"],
    ["Are you taking any medicine?", "No, I am not taking any medicine.", "您正在服用什么药吗？", "没有，我目前没有服药。"],
    ["May I check your temperature?", "Yes, of course.", "我可以量一下您的体温吗？", "可以，当然可以。"],
    ["Do you need an interpreter?", "Yes, a Chinese interpreter, please.", "您需要翻译吗？", "需要，请安排中文翻译。"],
    ["Can you wait here for the doctor?", "Yes. How long will it take?", "您可以在这里等医生吗？", "可以，大约要等多久？"],
    ["Do you understand the next steps?", "Yes. I will take this form to room three.", "您明白下一步怎么做吗？", "明白，我会拿着这张表去三号房间。"],
  ],
  cafe: [
    ["Hello. What would you like today?", "A small coffee, please.", "您好，今天想喝什么？", "请给我一杯小咖啡。"],
    ["Would you like it hot or iced?", "Hot, please.", "您想要热的还是冰的？", "请给我热的。"],
    ["Which milk would you like?", "Regular milk, please.", "您想要哪种牛奶？", "请加普通牛奶。"],
    ["Would you like sugar?", "No sugar, thank you.", "需要糖吗？", "不要糖，谢谢。"],
    ["Would you like anything to eat?", "Yes, one sandwich, please.", "需要吃点什么吗？", "需要，请给我一个三明治。"],
    ["Is that for here or to go?", "For here, please.", "在这里喝还是带走？", "在这里喝。"],
    ["What name should I put on the order?", "My name is Anna.", "订单上写什么名字？", "我叫安娜。"],
    ["Will you pay by cash or card?", "By card, please.", "用现金还是刷卡？", "请刷卡。"],
    ["Here is your drink. Is everything correct?", "Yes, this is exactly what I ordered.", "您的饮料好了，都对吗？", "对，这就是我点的。"],
    ["Do you need anything else?", "No, thank you. Have a nice day.", "还需要什么吗？", "不需要了，谢谢，祝您今天愉快。"],
  ],
  school: [
    ["Hello. Are you a new student?", "Yes, today is my first day.", "你好，你是新同学吗？", "是的，今天是我第一天上课。"],
    ["What is your name?", "My name is Alex.", "你叫什么名字？", "我叫亚历克斯。"],
    ["Which course are you taking?", "I am taking the beginner language course.", "你在上什么课程？", "我在上初级语言课程。"],
    ["Do you know your classroom?", "No. Where is room twelve?", "你知道教室在哪里吗？", "不知道，十二号教室在哪里？"],
    ["Do you have your student card?", "Yes, here is my card.", "你有学生证吗？", "有，这是我的学生证。"],
    ["Did you bring a notebook?", "Yes, I also brought a pen.", "你带笔记本了吗？", "带了，我还带了笔。"],
    ["Do you understand the homework?", "Not yet. Could you explain it again?", "你明白作业要求吗？", "还不明白，可以再讲一次吗？"],
    ["Would you like to join our study group?", "Yes, when does the group meet?", "你想加入学习小组吗？", "想，小组什么时候见面？"],
    ["Can you attend class tomorrow?", "Yes, I will be here at nine.", "你明天能来上课吗？", "能，我九点会到。"],
    ["Do you need any other help?", "No, thank you. I know what to do now.", "还需要其他帮助吗？", "不需要了，谢谢，我现在知道怎么做了。"],
  ],
  library: [
    ["Hello. What are you looking for?", "I am looking for a history book.", "您好，您在找什么？", "我在找一本历史书。"],
    ["Do you know the book title?", "Yes, I wrote the title here.", "您知道书名吗？", "知道，我把书名写在这里了。"],
    ["Would you like a printed book or an e-book?", "A printed book, please.", "您想要纸质书还是电子书？", "请给我纸质书。"],
    ["Do you have a library card?", "Yes, here is my card.", "您有借书证吗？", "有，这是我的借书证。"],
    ["May I help you use the catalog?", "Yes, please show me how to search.", "需要我帮您使用目录吗？", "需要，请教我怎么搜索。"],
    ["The book is on the second floor. Do you need directions?", "Yes. Where are the stairs?", "这本书在二楼，需要指路吗？", "需要，请问楼梯在哪里？"],
    ["Would you like to reserve this book?", "Yes, please tell me when it is available.", "您要预约这本书吗？", "要，请告诉我什么时候可以借。"],
    ["How long would you like to borrow it?", "For two weeks, please.", "您想借多久？", "请借给我两周。"],
    ["Do you need a quiet place to study?", "Yes. Is there a study room?", "您需要安静的学习位置吗？", "需要，请问有自习室吗？"],
    ["Are you finished with these books?", "Yes, I would like to return them.", "这些书您看完了吗？", "看完了，我想归还这些书。"],
  ],
  grocery: [
    ["Hello. Can I help you find something?", "Yes, where are the eggs?", "您好，需要帮您找东西吗？", "需要，请问鸡蛋在哪里？"],
    ["Would you like white or brown eggs?", "Brown eggs, please.", "您想要白壳还是褐壳鸡蛋？", "请给我褐壳鸡蛋。"],
    ["How much meat do you need?", "Half a kilogram, please.", "您需要多少肉？", "请给我半公斤。"],
    ["Would you like fresh or frozen vegetables?", "Fresh vegetables, please.", "您想要新鲜还是冷冻蔬菜？", "请给我新鲜蔬菜。"],
    ["Are these apples okay?", "Yes, but I only need four.", "这些苹果可以吗？", "可以，不过我只要四个。"],
    ["Do you need a bag?", "Yes, one reusable bag, please.", "您需要袋子吗？", "需要，请给我一个环保袋。"],
    ["Do you have a membership card?", "No, I do not have one.", "您有会员卡吗？", "没有，我没有会员卡。"],
    ["Would you like to use a coupon?", "Yes, here is my coupon.", "您要使用优惠券吗？", "要，这是我的优惠券。"],
    ["Will you pay by cash or card?", "By card, please.", "您用现金还是刷卡？", "请刷卡。"],
    ["Would you like the receipt?", "Yes, please put it in the bag.", "您需要收据吗？", "需要，请放在袋子里。"],
  ],
  transit: [
    ["Hello. Where would you like to go?", "I need to go to Central Station.", "您好，您想去哪里？", "我要去中央车站。"],
    ["Would you like a one-way or return ticket?", "A return ticket, please.", "您要单程票还是往返票？", "请给我往返票。"],
    ["Are you traveling today?", "Yes, on the next train.", "您今天出发吗？", "是的，我坐下一班车。"],
    ["Would you like a seat reservation?", "Yes, an aisle seat, please.", "需要预订座位吗？", "需要，请给我靠过道的座位。"],
    ["Do you know which platform to use?", "No. Which platform is it?", "您知道去哪个站台吗？", "不知道，请问是哪个站台？"],
    ["The train is delayed. Can you wait twenty minutes?", "Yes. Please tell me when it arrives.", "列车晚点了，您可以等二十分钟吗？", "可以，到站时请告诉我。"],
    ["Do you need to change trains?", "Yes. Where do I change?", "您需要换车吗？", "需要，我在哪里换车？"],
    ["May I see your ticket?", "Yes, it is on my phone.", "可以看一下您的票吗？", "可以，票在我的手机里。"],
    ["Do you need the elevator?", "Yes, I have a heavy suitcase.", "您需要电梯吗？", "需要，我有一个很重的行李箱。"],
    ["Is this your stop?", "Yes, thank you for telling me.", "这是您要下的站吗？", "是的，谢谢您提醒我。"],
  ],
  pharmacy: [
    ["Hello. How can I help you?", "I need something for a headache.", "您好，需要什么帮助？", "我需要治疗头痛的药。"],
    ["How long have you had the headache?", "Since this morning.", "您头痛多久了？", "从今天早上开始。"],
    ["Do you have any allergies?", "No, I do not have any allergies.", "您有过敏吗？", "没有，我没有过敏。"],
    ["Are you taking other medicine?", "Yes, I take this medicine every day.", "您正在服用其他药物吗？", "有，我每天服用这种药。"],
    ["Would you like tablets or liquid medicine?", "Tablets, please.", "您想要药片还是药水？", "请给我药片。"],
    ["Do you understand how to take it?", "Not yet. How many times a day?", "您明白怎么服用吗？", "还不明白，一天服用几次？"],
    ["Can you take it after food?", "Yes, I will take it after breakfast.", "您可以饭后服用吗？", "可以，我会在早餐后服用。"],
    ["Do you need a smaller package?", "Yes, the smallest package, please.", "您需要小包装吗？", "需要，请给我最小包装。"],
    ["Would you like to speak to the pharmacist?", "Yes, I have one more question.", "您想咨询药剂师吗？", "想，我还有一个问题。"],
    ["Do you need a receipt?", "Yes, please. Thank you for your help.", "您需要收据吗？", "需要，谢谢您的帮助。"],
  ],
  bank: [
    ["Welcome. How can I help you?", "I would like to open an account.", "欢迎光临，需要什么帮助？", "我想开一个账户。"],
    ["May I see your identification?", "Yes, here is my passport.", "可以看一下您的证件吗？", "可以，这是我的护照。"],
    ["Would you like a checking or savings account?", "A checking account, please.", "您想开活期还是储蓄账户？", "请帮我开活期账户。"],
    ["How much would you like to deposit?", "I would like to deposit five hundred dollars.", "您想存多少钱？", "我想存五百美元。"],
    ["Would you like a debit card?", "Yes, please send it to this address.", "您需要借记卡吗？", "需要，请寄到这个地址。"],
    ["Do you need online banking?", "Yes, please help me set it up.", "您需要网上银行吗？", "需要，请帮我设置。"],
    ["Is there a problem with your card?", "Yes, my card is not working.", "您的银行卡有问题吗？", "有，我的卡不能用了。"],
    ["Would you like to transfer money?", "Yes, I need to send money abroad.", "您需要转账吗？", "需要，我要汇款到国外。"],
    ["Do you want to check your balance?", "Yes, please show me my current balance.", "您要查询余额吗？", "要，请告诉我当前余额。"],
    ["Do you need a printed receipt?", "Yes, please. That is everything.", "您需要纸质收据吗？", "需要，谢谢，就这些。"],
  ],
  police: [
    ["Hello. Are you safe right now?", "Yes, I am safe, but I need help.", "您好，您现在安全吗？", "安全，不过我需要帮助。"],
    ["What happened?", "I lost my phone on the bus.", "发生了什么事？", "我的手机落在公交车上了。"],
    ["When did you last see it?", "I had it about one hour ago.", "您最后什么时候见到它？", "大约一小时前我还拿着它。"],
    ["Where were you at that time?", "I was near Central Station.", "当时您在哪里？", "我当时在中央车站附近。"],
    ["Can you describe the phone?", "It is a black phone with a red case.", "您能描述一下手机吗？", "是一部黑色手机，有红色手机壳。"],
    ["Do you have identification?", "Yes, here is my identification.", "您有身份证件吗？", "有，这是我的证件。"],
    ["Do you need an interpreter?", "Yes, a Chinese interpreter, please.", "您需要翻译吗？", "需要，请安排中文翻译。"],
    ["Can you complete this report?", "Yes, but I need help with one question.", "您可以填写这份报告吗？", "可以，不过有一个问题需要帮助。"],
    ["Do you understand what happens next?", "Not completely. Could you explain it again?", "您明白下一步怎么处理吗？", "不完全明白，可以再解释一次吗？"],
    ["Do you need the report number?", "Yes, please write it down for me.", "您需要报案编号吗？", "需要，请帮我写下来。"],
  ],
};

const LEVEL_CONTEXTS = {
  intermediate: {
    en: ["I also need to know the time.", "There has been a small change.", "Please explain the available options.", "I need this before noon.", "I have one special request.", "Could you confirm the details?", "I tried once already.", "Please tell me the total cost.", "I may need another option.", "Thank you for explaining the next step."],
    zh: ["我还需要知道时间。", "情况有一点变化。", "请说明有哪些选择。", "我需要在中午前办好。", "我有一个特别要求。", "可以确认一下细节吗？", "我已经尝试过一次。", "请告诉我总费用。", "我可能还需要另一个选择。", "谢谢您说明下一步。"],
  },
  advanced: {
    en: ["Please also explain what I should do if the schedule changes.", "The original arrangement no longer works, so I need a practical alternative.", "Please compare the options and explain the main difference.", "This affects another appointment, so the timing needs to be accurate.", "I would appreciate an option that meets this additional requirement.", "Before I agree, please confirm every important detail.", "The first solution did not work, so I need help identifying the cause.", "Please itemize the total and point out any extra fee.", "If that is unavailable, please recommend the most reliable alternative.", "Thank you; I now understand both the immediate step and what follows."],
    zh: ["如果时间有变化，也请说明我应该怎么处理。", "原来的安排已经不适用，所以我需要一个实际可行的替代方案。", "请比较这些选择并说明主要区别。", "这会影响另一个预约，所以时间必须准确。", "如果能满足这个额外要求，我会非常感谢。", "在我确认以前，请核对所有重要细节。", "第一个办法没有解决问题，请帮我找出原因。", "请列出总金额，并说明是否有额外费用。", "如果这个方案不可用，请推荐最可靠的替代选择。", "谢谢，我现在既明白眼前这一步，也知道接下来会发生什么。"],
  },
} as const;

const FALLBACK_QUESTIONS: Record<SmartLingoLearningLanguage, readonly string[]> = {
  zh: ["您好，需要什么帮助？", "您想要哪一个？", "您有需要的资料吗？", "您更喜欢哪种选择？", "您需要什么时间？", "遇到什么问题了吗？", "您需要多少？", "您想怎么付款？", "这些信息正确吗？", "还需要其他帮助吗？"],
  en: ["Hello. How can I help?", "Which one would you like?", "Do you have the required information?", "Which option do you prefer?", "What time do you need?", "Is there a problem?", "How much do you need?", "How would you like to pay?", "Are these details correct?", "Do you need anything else?"],
  es: ["Hola. ¿En qué puedo ayudarle?", "¿Cuál desea?", "¿Tiene la información necesaria?", "¿Qué opción prefiere?", "¿A qué hora lo necesita?", "¿Hay algún problema?", "¿Cuánto necesita?", "¿Cómo desea pagar?", "¿Son correctos estos datos?", "¿Necesita algo más?"],
  ja: ["こんにちは。どのようなご用件ですか。", "どちらがよろしいですか。", "必要な情報をお持ちですか。", "どの方法がよろしいですか。", "何時がよろしいですか。", "何か問題がありますか。", "どのくらい必要ですか。", "お支払い方法はどうしますか。", "この内容でよろしいですか。", "ほかに必要なことはありますか。"],
  ko: ["안녕하세요. 무엇을 도와드릴까요?", "어느 것을 원하세요?", "필요한 정보가 있으세요?", "어떤 방법을 원하세요?", "몇 시에 필요하세요?", "무슨 문제가 있나요?", "얼마나 필요하세요?", "어떻게 결제하시겠어요?", "이 정보가 맞나요?", "더 필요한 것이 있나요?"],
  fr: ["Bonjour. Comment puis-je vous aider ?", "Lequel désirez-vous ?", "Avez-vous les informations nécessaires ?", "Quelle option préférez-vous ?", "À quelle heure en avez-vous besoin ?", "Y a-t-il un problème ?", "De quelle quantité avez-vous besoin ?", "Comment souhaitez-vous payer ?", "Ces informations sont-elles correctes ?", "Avez-vous besoin d’autre chose ?"],
  de: ["Guten Tag. Wie kann ich Ihnen helfen?", "Welches möchten Sie?", "Haben Sie die nötigen Angaben?", "Welche Möglichkeit bevorzugen Sie?", "Für welche Uhrzeit brauchen Sie es?", "Gibt es ein Problem?", "Wie viel brauchen Sie?", "Wie möchten Sie bezahlen?", "Sind diese Angaben richtig?", "Brauchen Sie noch etwas?"],
  ru: ["Здравствуйте. Чем я могу вам помочь?", "Какой вариант вы хотите?", "У вас есть нужные данные?", "Какой вариант вы предпочитаете?", "На какое время вам нужно?", "Возникла проблема?", "Сколько вам нужно?", "Как вы хотите оплатить?", "Эти данные верны?", "Вам нужно что-нибудь ещё?"],
  it: ["Buongiorno. Come posso aiutarla?", "Quale desidera?", "Ha le informazioni necessarie?", "Quale opzione preferisce?", "A che ora le serve?", "C’è un problema?", "Quanto le serve?", "Come desidera pagare?", "Questi dati sono corretti?", "Le serve altro?"],
  pt: ["Olá. Como posso ajudar?", "Qual você deseja?", "Você tem as informações necessárias?", "Qual opção você prefere?", "Para que horário você precisa?", "Há algum problema?", "De quanto você precisa?", "Como deseja pagar?", "Esses dados estão corretos?", "Precisa de mais alguma coisa?"],
  ar: ["مرحبًا. كيف يمكنني مساعدتك؟", "أي واحد تريد؟", "هل لديك المعلومات المطلوبة؟", "أي خيار تفضّل؟", "في أي وقت تحتاجه؟", "هل توجد مشكلة؟", "كم تحتاج؟", "كيف تود الدفع؟", "هل هذه المعلومات صحيحة؟", "هل تحتاج إلى شيء آخر؟"],
  hi: ["नमस्ते। मैं आपकी कैसे मदद कर सकता हूँ?", "आप कौन-सा चाहेंगे?", "क्या आपके पास ज़रूरी जानकारी है?", "आप कौन-सा विकल्प पसंद करेंगे?", "आपको किस समय चाहिए?", "क्या कोई समस्या है?", "आपको कितना चाहिए?", "आप कैसे भुगतान करना चाहेंगे?", "क्या ये जानकारी सही है?", "क्या आपको कुछ और चाहिए?"],
};

const FALLBACK_QUESTION_MEANINGS = {
  en: ["Hello. How can I help?", "Which one would you like?", "Do you have the required information?", "Which option do you prefer?", "What time do you need?", "Is there a problem?", "How much do you need?", "How would you like to pay?", "Are these details correct?", "Do you need anything else?"],
  zh: ["您好，需要什么帮助？", "您想要哪一个？", "您有需要的资料吗？", "您更喜欢哪种选择？", "您需要什么时间？", "遇到什么问题了吗？", "您需要多少？", "您想怎么付款？", "这些信息正确吗？", "还需要其他帮助吗？"],
} as const;

function baseLines(sceneId: string, language: SmartLingoLearningLanguage, level: SmartLingoLevel): EverydayDialogueLine[] {
  const pairs = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[sceneId] || SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe;
  if (language !== "en" && language !== "zh") {
    const fallbackAnswers = buildCourseSentenceBank(language, level).filter(item => item.scenario === sceneId).slice(0, 10);
    return fallbackAnswers.flatMap((answer, pairIndex) => [
      { role: "staff" as const, target: FALLBACK_QUESTIONS[language][pairIndex], meaningZh: FALLBACK_QUESTION_MEANINGS.zh[pairIndex], meaningEn: FALLBACK_QUESTION_MEANINGS.en[pairIndex], pairIndex },
      { role: "learner" as const, target: answer.targetSentence, meaningZh: answer.translation.zh, meaningEn: answer.translation.en, pairIndex },
    ]);
  }
  return pairs.flatMap((pair, pairIndex) => {
    const question = language === "zh" ? pair[2] : pair[0];
    let answer = language === "zh" ? pair[3] : pair[1];
    if (level !== "beginner") answer = `${answer} ${LEVEL_CONTEXTS[level][language === "zh" ? "zh" : "en"][pairIndex]}`;
    return [
      { role: "staff" as const, target: question, meaningZh: pair[2], meaningEn: pair[0], pairIndex },
      { role: "learner" as const, target: answer, meaningZh: `${pair[3]}${level === "beginner" ? "" : ` ${LEVEL_CONTEXTS[level].zh[pairIndex]}`}`, meaningEn: `${pair[1]}${level === "beginner" ? "" : ` ${LEVEL_CONTEXTS[level].en[pairIndex]}`}`, pairIndex },
    ];
  });
}

function parseLocalized(value: string, base: readonly BasePair[], level: SmartLingoLevel): EverydayDialogueLine[] | null {
  const start = value.indexOf("[");
  const end = value.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value.slice(start, end + 1)); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length !== 10) return null;
  const result: EverydayDialogueLine[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index] as { question?: unknown; answer?: unknown };
    const question = typeof item?.question === "string" ? item.question.trim().slice(0, 220) : "";
    const answer = typeof item?.answer === "string" ? item.answer.trim().slice(0, 260) : "";
    if (!question || !answer) return null;
    const source = base[index];
    const contextZh = level === "beginner" ? "" : ` ${LEVEL_CONTEXTS[level].zh[index]}`;
    const contextEn = level === "beginner" ? "" : ` ${LEVEL_CONTEXTS[level].en[index]}`;
    result.push(
      { role: "staff", target: question, meaningZh: source[2], meaningEn: source[0], pairIndex: index },
      { role: "learner", target: answer, meaningZh: `${source[3]}${contextZh}`, meaningEn: `${source[1]}${contextEn}`, pairIndex: index },
    );
  }
  return result;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function prebuiltEverydayDialogueLines(sceneId: string, language: SmartLingoLearningLanguage, level: SmartLingoLevel) {
  return baseLines(sceneId, language, level);
}

export async function everydayDialogueLines(input: {
  database: Database;
  sceneId: string;
  language: SmartLingoLearningLanguage;
  level: SmartLingoLevel;
}): Promise<{ lines: EverydayDialogueLine[]; releaseId: string; sourceType: "prebuilt" | "gpt-5.6-luna" | "safe-fallback" }> {
  const base = SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[input.sceneId] || SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe;
  const release = await input.database.prepare("SELECT release_id AS releaseId FROM smartlingo_learning_content_releases WHERE content_key='everyday-dialogues' LIMIT 1").first<{ releaseId: string }>();
  const releaseId = release?.releaseId || "bootstrap-2026-08-23";
  if (input.language === "en" || input.language === "zh") return { lines: baseLines(input.sceneId, input.language, input.level), releaseId, sourceType: "prebuilt" };
  const cacheKey = `everyday:${releaseId}:${input.sceneId}:${input.language}:${input.level}:${stableHash(JSON.stringify(base))}`;
  const cached = await input.database.prepare("SELECT payload_json AS payloadJson,source_type AS sourceType FROM smartlingo_everyday_dialogue_sets WHERE cache_key=? AND release_id=? LIMIT 1").bind(cacheKey, releaseId).first<{ payloadJson: string; sourceType: "gpt-5.6-luna" | "safe-fallback" }>();
  if (cached) {
    try { return { lines: JSON.parse(cached.payloadJson) as EverydayDialogueLine[], releaseId, sourceType: cached.sourceType }; } catch { /* regenerate malformed cache */ }
  }
  const { askSmartAi } = await import("./smartlingo-ai-gateway.ts");
  const response = await askSmartAi({
    feature: "content_help",
    subject: `everyday-dialogue:${input.sceneId}:${input.language}:${input.level}`,
    language: "en",
    instructions: `Localize ten practical role-play pairs into target language ${input.language}. Return JSON only: exactly ten objects shaped {"question":"staff line","answer":"learner line"}. Preserve the supplied real-life intent and question-answer logic. Use natural polite speech. Level=${input.level}: beginner uses short A1 survival language; intermediate adds useful detail and a minor complication; advanced uses natural B1-B2 clarification or negotiation without becoming formal or verbose. Never translate names literally. No notes, romanization, labels, markdown, or extra keys.`,
    content: JSON.stringify(base.map((pair, index) => ({ pair: index + 1, staffEnglish: pair[0], learnerEnglish: pair[1], staffChinese: pair[2], learnerChinese: pair[3] }))),
    preserveOnFailure: "",
    deps: { policyOverrides: { content_help: { timeoutMs: 8_000 } } },
  }).catch(() => ({ value: "" }));
  const generated = response.value ? parseLocalized(response.value, base, input.level) : null;
  const lines = generated || baseLines(input.sceneId, input.language, input.level);
  const sourceType = generated ? "gpt-5.6-luna" as const : "safe-fallback" as const;
  await input.database.prepare(`INSERT INTO smartlingo_everyday_dialogue_sets(cache_key,release_id,target_language,level,scenario,payload_json,source_type,created_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,source_type=excluded.source_type,created_at=excluded.created_at`)
    .bind(cacheKey, releaseId, input.language, input.level, input.sceneId, JSON.stringify(lines), sourceType, Math.floor(Date.now() / 1000)).run().catch(() => ({ success: false }));
  return { lines, releaseId, sourceType };
}
