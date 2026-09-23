import type { SmartLingoLearningLanguage, SmartLingoLevel } from "./smartlingo-learning.ts";
import { SMARTLINGO_EVERYDAY_EXTRA_LEVEL_BRIEFS } from "./smartlingo-everyday-extra-level-briefs.ts";

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

/**
 * Level-specific scene briefs. Beginner deliberately keeps the ten short
 * exchanges above. Intermediate practices a complete transaction; advanced
 * practices resolving a realistic change or error within that transaction.
 * Both languages describe the same task so localization has one clear intent.
 */
export const SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS: Record<
  "airport" | "hotel" | "restaurant" | "hospital" | "school" | "library" | "pharmacy" | "bank" | "police" | "cafe" | "grocery" | "transit",
  Record<"intermediate" | "advanced", readonly BasePair[]>
> = {
  ...SMARTLINGO_EVERYDAY_EXTRA_LEVEL_BRIEFS,
  cafe: {
    intermediate: [
      ["What can I get you today?", "A medium iced coffee with oat milk, please.", "今天想点什么？", "请给我一杯中杯燕麦奶冰咖啡。"],
      ["We are out of oat milk. Would soy milk be okay?", "Yes, soy milk is fine. Please keep it iced.", "燕麦奶卖完了，豆奶可以吗？", "可以，豆奶也行。请保持冰的。"],
      ["Would you like the coffee sweetened?", "Just one pump of vanilla syrup, please.", "咖啡需要加甜吗？", "请只加一泵香草糖浆。"],
      ["Would you like a sandwich with that?", "Does the egg sandwich contain cheese?", "还要来一份三明治吗？", "鸡蛋三明治里有奶酪吗？"],
      ["It does. Would you prefer the vegetable sandwich?", "Yes, one vegetable sandwich, please.", "有奶酪。您要换成蔬菜三明治吗？", "好，请给我一份蔬菜三明治。"],
      ["Is this order for here or to go?", "To go, please. Put the sandwich in a separate bag.", "在店里吃还是带走？", "带走。请把三明治单独装袋。"],
      ["Your total is eight dollars fifty. How would you like to pay?", "By card, please.", "一共八美元五角，您怎么付款？", "请刷卡。"],
      ["What name should I call when the order is ready?", "Please use Mei. Could you repeat my order first?", "做好后叫您什么名字？", "请叫梅。能先重复一遍我的订单吗？"],
      ["One medium iced coffee with soy milk and one vegetable sandwich. Correct?", "Yes, and only one pump of vanilla syrup in the coffee.", "一杯中杯豆奶冰咖啡和一份蔬菜三明治，对吗？", "对，咖啡里只加一泵香草糖浆。"],
      ["Here is your order. Is everything right?", "Yes, I have both the drink and the sandwich. Thank you.", "这是您的订单，都对吗？", "对，饮料和三明治都拿到了，谢谢。"],
    ],
    advanced: [
      ["We made your coffee hot by mistake. Would you like us to remake it?", "Yes, please. I ordered an iced coffee with oat milk.", "我们不小心把咖啡做成热的了，需要重做吗？", "需要，谢谢。我点的是燕麦奶冰咖啡。"],
      ["I am sorry, but we are out of oat milk. Would almond milk work?", "I have a nut allergy, so almond milk will not work. What else do you have?", "抱歉，燕麦奶也卖完了。杏仁奶可以吗？", "我对坚果过敏，不能喝杏仁奶。还有什么选择？"],
      ["We have soy milk or regular milk. Which would you prefer?", "Soy milk, please. Could you use a clean cup?", "我们还有豆奶和普通牛奶，您选哪种？", "请用豆奶。能换一个干净的杯子吗？"],
      ["Would you like to keep the same medium size?", "Yes, please keep the same size and make it iced.", "还要保持原来的中杯吗？", "是的，请保持中杯，并做成冰的。"],
      ["Your receipt shows an extra charge for soy milk. Would you like me to check it?", "Yes. I did not see that charge on the menu. Could you explain it?", "收据上有一笔豆奶附加费，需要我查一下吗？", "需要。菜单上我没看到这笔费用，能解释一下吗？"],
      ["The soy milk costs extra. Would you rather have regular milk?", "No, please keep the soy milk. I just need to know the final price.", "豆奶需要加钱。您要改成普通牛奶吗？", "不用，请继续用豆奶。我只是想确认最终价格。"],
      ["I also charged you for a larger size by mistake. Shall I refund the difference?", "Yes, please refund the overcharge to the same card.", "我还误收了大杯的费用，要退还差价吗？", "要，请把多收的钱退回原卡。"],
      ["The new drink will take a few minutes. Can you wait?", "Yes. Please call my name when it is ready.", "新饮料还要等几分钟，可以吗？", "可以。做好后请叫我的名字。"],
      ["Here is the remade coffee. Is the milk and temperature correct?", "Yes, it is iced and made with soy milk. Thank you for checking.", "这是重做的咖啡，奶和温度都对吗？", "对，是冰的，也用了豆奶。谢谢您核对。"],
      ["Would you like an updated receipt for the correction?", "Yes, please. It will help me check the refund.", "需要一张更正后的收据吗？", "需要，谢谢。这样方便我核对退款。"],
    ],
  },
  grocery: {
    intermediate: [
      ["Can I help you find anything?", "Yes. Where are the eggs, and are any on sale?", "需要我帮您找什么吗？", "需要。鸡蛋在哪里？有打折的吗？"],
      ["The large eggs are on sale. How many cartons do you need?", "One carton, please. Could I check the eggs before buying?", "大号鸡蛋在打折，您要几盒？", "要一盒。买之前我能检查一下鸡蛋吗？"],
      ["Of course. Do any of them look broken?", "This one is cracked. May I take another carton?", "当然可以，有破的吗？", "这里有一个裂了。我能换一盒吗？"],
      ["What kind of meat are you looking for?", "Half a kilogram of chicken, please. Is it fresh today?", "您要买什么肉？", "请给我半公斤鸡肉。今天是新鲜到货的吗？"],
      ["Yes. Would you like it cut into smaller pieces?", "Yes, please cut it into pieces for a soup.", "是的。需要切成小块吗？", "需要，请切成适合煮汤的小块。"],
      ["The spinach is sold out. Would another vegetable work?", "Yes. What fresh leafy vegetables do you have?", "菠菜卖完了，换别的蔬菜可以吗？", "可以。还有哪些新鲜绿叶菜？"],
      ["We have kale and lettuce. Which would you like?", "Kale, please. How much is it per bunch?", "有羽衣甘蓝和生菜，您要哪种？", "要羽衣甘蓝。多少钱一把？"],
      ["Do you have a coupon for these groceries?", "Yes, here it is. Does it apply to the eggs?", "这些商品有优惠券吗？", "有，在这里。鸡蛋可以用吗？"],
      ["The coupon applies to the eggs. Would you like a bag?", "Yes, one reusable bag, please. Keep the meat separate.", "这张优惠券可以用于鸡蛋。您需要袋子吗？", "需要一个环保袋。请把肉分开装。"],
      ["The total is twenty-three dollars. Would you like the receipt?", "Yes, please. I want to check the discount.", "一共二十三美元，需要收据吗？", "需要。我想核对一下折扣。"],
    ],
    advanced: [
      ["The eggs you wanted are sold out. Would you like a different size?", "What sizes are available, and what is the price per egg?", "您要的鸡蛋卖完了，要换另一种规格吗？", "还有哪些规格？每个鸡蛋分别多少钱？"],
      ["The smaller carton costs less overall but more per egg. Which do you prefer?", "I will take the larger carton if none of the eggs are cracked.", "小盒总价更低，但每个鸡蛋更贵。您选哪种？", "如果鸡蛋都没有破，我选大盒。"],
      ["This carton has a cracked egg. Shall I find another one?", "Yes, please. I need a carton with all the eggs intact.", "这盒有个鸡蛋裂了，要我再找一盒吗？", "要，谢谢。我需要一盒鸡蛋都完好的。"],
      ["The chicken you selected is priced by weight. Is this amount okay?", "It is too much. Could you make it closer to half a kilogram?", "您选的鸡肉按重量计价，这个分量可以吗？", "太多了，能调整到接近半公斤吗？"],
      ["This package is about half a kilogram. Would you like to check the label?", "Yes. Please show me the price and the use-by date.", "这包大约半公斤，要看标签吗？", "要，请让我看价格和保质期。"],
      ["The shelf label says the vegetables are on sale, but the register shows full price. Should I check?", "Yes, please check the shelf price before I pay.", "货架标签说蔬菜打折，但收银机显示原价。需要我核对吗？", "需要，请在我付款前核对货架价格。"],
      ["You are right. Shall I correct the price at the register?", "Yes, please. Could you also check whether my coupon was applied?", "您说得对，要我在收银机上改价吗？", "要，谢谢。也请查一下优惠券是否生效。"],
      ["The coupon has expired, so it cannot be applied. Do you still want the eggs?", "Yes, I will keep the eggs, but please tell me the new total.", "优惠券过期了，不能用。鸡蛋还要吗？", "还要，但请告诉我新的总价。"],
      ["The corrected total is twenty-six dollars. Is that okay?", "Yes. Please charge my card only once and give me the receipt.", "改价后一共二十六美元，可以吗？", "可以。请只刷一次卡，并给我收据。"],
      ["Here is your receipt. Does it show the corrected vegetable price?", "Yes, it does. Thank you for checking the price before I left.", "这是收据，上面显示蔬菜改价了吗？", "显示了。谢谢您在我离开前核对价格。"],
    ],
  },
  transit: {
    intermediate: [
      ["Where are you traveling today?", "I need to get to Central Station before five o'clock.", "今天您要去哪里？", "我要在五点前到中央车站。"],
      ["The next train leaves at three thirty. Would that work?", "Yes. Does it go directly to Central Station?", "下一班车三点半发车，可以吗？", "可以。这趟车直达中央车站吗？"],
      ["No, you need to change at River Station. Is that okay?", "Yes. How much time will I have to change trains?", "不直达，您需要在河畔站换车，可以吗？", "可以。换车时我有多少时间？"],
      ["You will have fifteen minutes. Do you need an accessible route?", "Yes, I have a suitcase. Is there an elevator?", "您有十五分钟换车。需要无障碍通道吗？", "需要，我有行李箱。有电梯吗？"],
      ["There is an elevator near platform two. Would you like directions?", "Yes, please tell me how to get there from here.", "二号站台附近有电梯，需要我指路吗？", "需要，请告诉我从这里怎么走。"],
      ["For this connecting route, would you like a one-way or return ticket?", "A one-way ticket, please. How much does it cost?", "这条换乘路线您要单程票还是往返票？", "请给我单程票。票价多少？"],
      ["It costs twelve dollars. Will you pay by card?", "Yes. Please confirm the transfer is included in the ticket.", "票价十二美元，您刷卡吗？", "是的。请确认这张票包含换乘。"],
      ["The transfer is included. Would you like a printed itinerary?", "Yes, please. I want to check both platform numbers.", "包含换乘。需要打印行程单吗？", "需要。我想核对两段行程的站台号。"],
      ["The first train now leaves from platform four. Did you hear the announcement?", "No, thank you. Is the departure time still three thirty?", "第一段列车改从四号站台发车，您听到广播了吗？", "没有，谢谢。发车时间还是三点半吗？"],
      ["Yes, it is. Do you know where platform four is?", "Yes. I will use the elevator and go there now.", "是的。您知道四号站台在哪里吗？", "知道。我现在乘电梯过去。"],
    ],
    advanced: [
      ["Your train to River Station has been canceled. Do you need another route?", "Yes. I must reach Central Station before five. What is the fastest option?", "前往河畔站的列车取消了，需要改走别的路线吗？", "需要。我必须在五点前到中央车站，最快的选择是什么？"],
      ["You could take a bus to West Station and change to the express train. Would you consider that?", "Yes. When does the bus leave, and how long is the transfer?", "可以坐公交到西站再换快车，您考虑吗？", "可以。公交几点发车？换乘时间有多长？"],
      ["The bus leaves in ten minutes, and you will have eight minutes to change. Is that enough?", "I have a suitcase, so eight minutes may be too short. Is there a later express?", "公交十分钟后发车，您有八分钟换乘，够吗？", "我有行李箱，八分钟可能太紧。还有晚一点的快车吗？"],
      ["Yes, but the later express arrives at five ten. Which matters more to you?", "I need to arrive before five. Is there an accessible direct bus instead?", "有，但较晚的快车五点十分才到。您更看重哪一点？", "我需要五点前到。有无障碍的直达公交吗？"],
      ["A direct bus arrives at four fifty, and it has space for your suitcase. Does that work?", "Yes. Can I use my existing train ticket on that bus?", "直达公交四点五十到，也有放行李的空间，可以吗？", "可以。我现有的火车票能用于这班公交吗？"],
      ["Your train ticket is not valid on the bus. Would you like to know the extra fare?", "Yes, please tell me the bus fare and whether my train ticket can be refunded.", "火车票不能用于公交。需要了解额外车费吗？", "需要。请告诉我公交票价，以及火车票能否退款。"],
      ["The bus costs four dollars. The canceled train ticket is eligible for a refund. Shall I start it?", "Yes, please start the refund and tell me how I will receive it.", "公交票价四美元。取消的火车票可以退款，要我办理吗？", "要，请办理退款，并告诉我会怎么收到钱。"],
      ["The refund will go to your original card. Would you like a confirmation?", "Yes, please give me written confirmation and the bus stop number.", "退款会退回原卡，需要确认凭证吗？", "需要，请给我书面确认和公交站台号。"],
      ["The direct bus leaves from stop six in ten minutes. Do you need the elevator route?", "Yes. Please show me the elevator route to stop six.", "直达公交十分钟后从六号站台发车，需要电梯路线吗？", "需要，请指给我去六号站台的电梯路线。"],
      ["You should arrive at Central Station at four fifty. Is there anything else to confirm?", "No. I have the bus ticket, refund confirmation, and stop number. Thank you.", "预计四点五十到中央车站，还需要确认什么吗？", "不用了。公交票、退款确认和站台号我都有了，谢谢。"],
    ],
  },
};

function sceneLevelPairs(sceneId: string, level: SmartLingoLevel): readonly BasePair[] {
  if (level !== "beginner" && sceneId in SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS) {
    return SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS[sceneId as keyof typeof SMARTLINGO_EVERYDAY_SCENE_LEVEL_BRIEFS][level];
  }
  return SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS[sceneId] || SMARTLINGO_EVERYDAY_DIALOGUE_BRIEFS.cafe;
}

function baseLines(sceneId: string, language: SmartLingoLearningLanguage, level: SmartLingoLevel): EverydayDialogueLine[] {
  if (language !== "en" && language !== "zh") return [];
  const pairs = sceneLevelPairs(sceneId, level);
  return pairs.flatMap((pair, pairIndex) => {
    const question = language === "zh" ? pair[2] : pair[0];
    const answer = language === "zh" ? pair[3] : pair[1];
    return [
      { role: "staff" as const, target: question, meaningZh: pair[2], meaningEn: pair[0], pairIndex },
      { role: "learner" as const, target: answer, meaningZh: pair[3], meaningEn: pair[1], pairIndex },
    ];
  });
}

const SCRIPT_FOR_LANGUAGE: Partial<Record<SmartLingoLearningLanguage, RegExp>> = {
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
};

function targetMatchesLanguage(target: string, language: SmartLingoLearningLanguage, sourceEnglish: string): boolean {
  const script = SCRIPT_FOR_LANGUAGE[language];
  if (script) return script.test(target);
  return target.toLocaleLowerCase() !== sourceEnglish.toLocaleLowerCase() && /\p{Script=Latin}/u.test(target);
}

export function validatedDialogueLines(lines: unknown, base: readonly BasePair[], language: SmartLingoLearningLanguage): lines is EverydayDialogueLine[] {
  if (!Array.isArray(lines) || lines.length !== 20 || base.length !== 10) return false;
  const questions = new Set<string>();
  const answers = new Set<string>();
  for (let index = 0; index < base.length; index += 1) {
    const question = lines[index * 2] as EverydayDialogueLine | undefined;
    const answer = lines[index * 2 + 1] as EverydayDialogueLine | undefined;
    if (!question || !answer || question.role !== "staff" || answer.role !== "learner"
      || question.pairIndex !== index || answer.pairIndex !== index
      || question.meaningEn !== base[index][0] || answer.meaningEn !== base[index][1]
      || question.meaningZh !== base[index][2] || answer.meaningZh !== base[index][3]
      || typeof question.target !== "string" || typeof answer.target !== "string"
      || !question.target.trim() || !answer.target.trim()
      || question.target.length > 220 || answer.target.length > 300
      || !targetMatchesLanguage(question.target, language, base[index][0])
      || !targetMatchesLanguage(answer.target, language, base[index][1])) return false;
    questions.add(question.target);
    answers.add(answer.target);
  }
  return questions.size === 10 && answers.size === 10;
}

function parseLocalized(value: string, base: readonly BasePair[], language: SmartLingoLearningLanguage): EverydayDialogueLine[] | null {
  const start = value.indexOf("[");
  const end = value.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value.slice(start, end + 1)); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length !== 10) return null;
  const result: EverydayDialogueLine[] = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index] as { pair?: unknown; question?: unknown; answer?: unknown };
    if (item?.pair !== index + 1) return null;
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    const answer = typeof item?.answer === "string" ? item.answer.trim() : "";
    if (!question || !answer || question.length > 220 || answer.length > 300) return null;
    const source = base[index];
    result.push(
      { role: "staff", target: question, meaningZh: source[2], meaningEn: source[0], pairIndex: index },
      { role: "learner", target: answer, meaningZh: source[3], meaningEn: source[1], pairIndex: index },
    );
  }
  return validatedDialogueLines(result, base, language) ? result : null;
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
  /** Deterministic test seam; production always uses the site AI gateway. */
  localize?: (pairs: readonly BasePair[], language: SmartLingoLearningLanguage, level: SmartLingoLevel) => Promise<string>;
}): Promise<{ lines: EverydayDialogueLine[]; releaseId: string; sourceType: "prebuilt" | "gpt-5.6-luna" }> {
  const base = sceneLevelPairs(input.sceneId, input.level);
  const release = await input.database.prepare("SELECT release_id AS releaseId FROM smartlingo_learning_content_releases WHERE content_key='everyday-dialogues' LIMIT 1").first<{ releaseId: string }>();
  const releaseId = release?.releaseId || "bootstrap-2026-08-23";
  if (input.language === "en" || input.language === "zh") return { lines: baseLines(input.sceneId, input.language, input.level), releaseId, sourceType: "prebuilt" };
  const cacheKey = `everyday:${releaseId}:${input.sceneId}:${input.language}:${input.level}:${stableHash(JSON.stringify(base))}`;
  const cached = await input.database.prepare("SELECT payload_json AS payloadJson,source_type AS sourceType FROM smartlingo_everyday_dialogue_sets WHERE cache_key=? AND release_id=? LIMIT 1").bind(cacheKey, releaseId).first<{ payloadJson: string; sourceType: string }>();
  if (cached?.sourceType === "gpt-5.6-luna") {
    try {
      const lines: unknown = JSON.parse(cached.payloadJson);
      if (validatedDialogueLines(lines, base, input.language)) return { lines, releaseId, sourceType: "gpt-5.6-luna" };
    } catch { /* regenerate malformed cache */ }
  }
  const localized = input.localize
    ? await input.localize(base, input.language, input.level).catch(() => "")
    : await (async () => {
      const { askSmartAi } = await import("./smartlingo-ai-gateway.ts");
      const response = await askSmartAi({
        feature: "content_help",
        subject: `everyday-dialogue:${input.sceneId}:${input.language}:${input.level}`,
        language: "en",
        instructions: `Localize ten practical role-play pairs into target language ${input.language}. Return JSON only: exactly ten objects shaped {"pair":1,"question":"staff line","answer":"learner line"}, with pair numbers 1 through 10 in order. Each learner answer MUST directly respond to that pair's staff question and preserve the real-life task. Do not replace a task with directions to the venue. Use natural polite speech at ${input.level} level; retain all scene-specific details, including safety-critical allergies, prices, times and route changes. Never translate names literally. No notes, romanization, labels, markdown, or extra keys.`,
        content: JSON.stringify(base.map((pair, index) => ({ pair: index + 1, staffEnglish: pair[0], learnerEnglish: pair[1], staffChinese: pair[2], learnerChinese: pair[3] }))),
        preserveOnFailure: "",
      }).catch(() => ({ value: "" }));
      return response.value;
    })();
  const lines = localized ? parseLocalized(localized, base, input.language) : null;
  if (!lines) throw new Error("Everyday dialogue localization is unavailable");
  await input.database.prepare(`INSERT INTO smartlingo_everyday_dialogue_sets(cache_key,release_id,target_language,level,scenario,payload_json,source_type,created_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,source_type=excluded.source_type,created_at=excluded.created_at`)
    .bind(cacheKey, releaseId, input.language, input.level, input.sceneId, JSON.stringify(lines), "gpt-5.6-luna", Math.floor(Date.now() / 1000)).run().catch(() => ({ success: false }));
  return { lines, releaseId, sourceType: "gpt-5.6-luna" };
}
