export const SMARTLINGO_LANGUAGE_COMMUNITIES = [
  { code: "zh", pathId: "path_zh_a1", classId: "class_official_zh", nameZh: "中文", nameEn: "Chinese", nativeName: "中文", speechLocale: "zh-CN", direction: "ltr" },
  { code: "en", pathId: "path_en_a1", classId: "class_official_en", nameZh: "英语", nameEn: "English", nativeName: "English", speechLocale: "en-US", direction: "ltr" },
  { code: "es", pathId: "path_es_a1", classId: "class_official_es", nameZh: "西班牙语", nameEn: "Spanish", nativeName: "Español", speechLocale: "es-ES", direction: "ltr" },
  { code: "ja", pathId: "path_ja_a1", classId: "class_official_ja", nameZh: "日语", nameEn: "Japanese", nativeName: "日本語", speechLocale: "ja-JP", direction: "ltr" },
  { code: "ko", pathId: "path_ko_a1", classId: "class_official_ko", nameZh: "韩语", nameEn: "Korean", nativeName: "한국어", speechLocale: "ko-KR", direction: "ltr" },
  { code: "fr", pathId: "path_fr_a1", classId: "class_official_fr", nameZh: "法语", nameEn: "French", nativeName: "Français", speechLocale: "fr-FR", direction: "ltr" },
  { code: "de", pathId: "path_de_a1", classId: "class_official_de", nameZh: "德语", nameEn: "German", nativeName: "Deutsch", speechLocale: "de-DE", direction: "ltr" },
  { code: "ru", pathId: "path_ru_a1", classId: "class_official_ru", nameZh: "俄语", nameEn: "Russian", nativeName: "Русский", speechLocale: "ru-RU", direction: "ltr" },
  { code: "it", pathId: "path_it_a1", classId: "class_official_it", nameZh: "意大利语", nameEn: "Italian", nativeName: "Italiano", speechLocale: "it-IT", direction: "ltr" },
  { code: "pt", pathId: "path_pt_a1", classId: "class_official_pt", nameZh: "葡萄牙语", nameEn: "Portuguese", nativeName: "Português", speechLocale: "pt-BR", direction: "ltr" },
  { code: "ar", pathId: "path_ar_a1", classId: "class_official_ar", nameZh: "阿拉伯语", nameEn: "Arabic", nativeName: "العربية", speechLocale: "ar-SA", direction: "rtl" },
  { code: "hi", pathId: "path_hi_a1", classId: "class_official_hi", nameZh: "印地语", nameEn: "Hindi", nativeName: "हिन्दी", speechLocale: "hi-IN", direction: "ltr" },
] as const;

export type SmartLingoCommunityLanguage = typeof SMARTLINGO_LANGUAGE_COMMUNITIES[number]["code"];

export const SMARTLINGO_COMMUNITY_LANGUAGE_CODES = SMARTLINGO_LANGUAGE_COMMUNITIES.map(({ code }) => code);

export function isSmartLingoCommunityLanguage(value: string): value is SmartLingoCommunityLanguage {
  return SMARTLINGO_COMMUNITY_LANGUAGE_CODES.some(code => code === value);
}
