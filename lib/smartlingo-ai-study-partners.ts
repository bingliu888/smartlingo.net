export const SMARTLINGO_AI_STUDY_PARTNERS = [
  {
    id: "mika",
    name: "Mika",
    avatar: "M",
    accent: "mint",
    activity: "conversation",
    titleEn: "Curious conversation partner",
    titleZh: "好奇型会话同学",
    bodyEn: "Takes turns, asks one useful follow-up, and invites you to try a more natural answer.",
    bodyZh: "一问一答，追问一个实用问题，并邀请您把回答说得更自然。",
  },
  {
    id: "leo",
    name: "Leo",
    avatar: "L",
    accent: "sun",
    activity: "challenge",
    titleEn: "Friendly quiz rival",
    titleZh: "友好型闯关对手",
    bodyEn: "Runs quick word and sentence rounds, celebrates wins, and explains misses without pressure.",
    bodyZh: "陪您做快速词句闯关，庆祝答对，并轻松讲清答错原因。",
  },
  {
    id: "aya",
    name: "Aya",
    avatar: "A",
    accent: "violet",
    activity: "roleplay",
    titleEn: "Real-life role-play partner",
    titleZh: "生活情景角色同学",
    bodyEn: "Plays the other person in cafés, shops, travel, school, and work conversations.",
    bodyZh: "在咖啡店、商店、旅行、学校和工作场景中扮演对话另一方。",
  },
] as const;

export type SmartLingoAiStudyPartnerId = (typeof SMARTLINGO_AI_STUDY_PARTNERS)[number]["id"];

export function smartLingoAiStudyPartner(value: unknown) {
  return SMARTLINGO_AI_STUDY_PARTNERS.find(partner => partner.id === value);
}
