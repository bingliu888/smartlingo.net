export const SMARTLINGO_TUTOR_PORTRAITS = [
  { id: "mei", image: "/tutors/mei.jpg", nameEn: "Mei", nameZh: "梅" },
  { id: "leo", image: "/tutors/leo.jpg", nameEn: "Leo", nameZh: "利奥" },
  { id: "sofia", image: "/tutors/sofia.jpg", nameEn: "Sofia", nameZh: "索菲娅" },
] as const;

export const SMARTLINGO_TUTOR_VOICES = [
  { id: "marin", name: "Marin" },
  { id: "gleam", name: "Gleam" },
  { id: "meridian", name: "Meridian" },
  { id: "willow", name: "Willow" },
] as const;

export type SmartLingoTutorPortrait = (typeof SMARTLINGO_TUTOR_PORTRAITS)[number]["id"];
export type SmartLingoTutorVoice = (typeof SMARTLINGO_TUTOR_VOICES)[number]["id"];

export function validTutorPortrait(value: unknown): value is SmartLingoTutorPortrait {
  return typeof value === "string" && SMARTLINGO_TUTOR_PORTRAITS.some(item => item.id === value);
}

export function validTutorVoice(value: unknown): value is SmartLingoTutorVoice {
  return typeof value === "string" && SMARTLINGO_TUTOR_VOICES.some(item => item.id === value);
}
