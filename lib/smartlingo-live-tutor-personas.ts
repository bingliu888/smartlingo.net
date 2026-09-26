export const SMARTLINGO_TUTOR_PORTRAITS = [
  { id: "mei", image: "/tutors/mei.jpg", width: 1000, height: 914, nameEn: "Mei", nameZh: "梅" },
  { id: "leo", image: "/tutors/leo.jpg", width: 1000, height: 838, nameEn: "Leo", nameZh: "利奥" },
  { id: "sofia", image: "/tutors/sofia.jpg", width: 1000, height: 914, nameEn: "Sofia", nameZh: "索菲娅" },
] as const;

export const SMARTLINGO_TUTOR_VOICES = [
  { id: "marin", name: "Marin" },
  { id: "gleam", name: "Gleam" },
  { id: "meridian", name: "Meridian" },
  { id: "willow", name: "Willow" },
] as const;

export type SmartLingoTutorPortrait = (typeof SMARTLINGO_TUTOR_PORTRAITS)[number]["id"];
export type SmartLingoTutorVoice = (typeof SMARTLINGO_TUTOR_VOICES)[number]["id"];

// GPT-Live documents the presentation of Gleam, Willow, and Meridian. Marin
// remains a legacy stored value, but has no documented presentation to match
// confidently with a tutor portrait.
export function tutorVoiceOptions(portrait: SmartLingoTutorPortrait) {
  return SMARTLINGO_TUTOR_VOICES.filter(item => portrait === "leo"
    ? item.id === "meridian"
    : item.id === "gleam" || item.id === "willow");
}

export function preferredTutorVoice(portrait: SmartLingoTutorPortrait, voice: unknown): SmartLingoTutorVoice {
  return tutorVoiceOptions(portrait).some(item => item.id === voice)
    ? voice as SmartLingoTutorVoice
    : portrait === "leo" ? "meridian" : "gleam";
}

export function tutorVoiceMatchesPortrait(portrait: unknown, voice: unknown): boolean {
  return validTutorPortrait(portrait) && validTutorVoice(voice)
    && tutorVoiceOptions(portrait).some(item => item.id === voice);
}

export function validTutorPortrait(value: unknown): value is SmartLingoTutorPortrait {
  return typeof value === "string" && SMARTLINGO_TUTOR_PORTRAITS.some(item => item.id === value);
}

export function validTutorVoice(value: unknown): value is SmartLingoTutorVoice {
  return typeof value === "string" && SMARTLINGO_TUTOR_VOICES.some(item => item.id === value);
}
