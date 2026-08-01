export const SMARTLINGO_LANGUAGE_COMMUNITIES = [
  { code: "zh", pathId: "path_zh_a1", classId: "class_official_zh", nameZh: "中文", nameEn: "Chinese" },
  { code: "en", pathId: "path_en_a1", classId: "class_official_en", nameZh: "英语", nameEn: "English" },
  { code: "es", pathId: "path_es_a1", classId: "class_official_es", nameZh: "西班牙语", nameEn: "Spanish" },
  { code: "ja", pathId: "path_ja_a1", classId: "class_official_ja", nameZh: "日语", nameEn: "Japanese" },
  { code: "ko", pathId: "path_ko_a1", classId: "class_official_ko", nameZh: "韩语", nameEn: "Korean" },
  { code: "fr", pathId: "path_fr_a1", classId: "class_official_fr", nameZh: "法语", nameEn: "French" },
  { code: "ru", pathId: "path_ru_a1", classId: "class_official_ru", nameZh: "俄语", nameEn: "Russian" },
  { code: "it", pathId: "path_it_a1", classId: "class_official_it", nameZh: "意大利语", nameEn: "Italian" },
  { code: "pt", pathId: "path_pt_a1", classId: "class_official_pt", nameZh: "葡萄牙语", nameEn: "Portuguese" },
] as const;

export type SmartLingoCommunityLanguage = typeof SMARTLINGO_LANGUAGE_COMMUNITIES[number]["code"];

export const SMARTLINGO_COMMUNITY_LANGUAGE_CODES = SMARTLINGO_LANGUAGE_COMMUNITIES.map(({ code }) => code);

export function isSmartLingoCommunityLanguage(value: string): value is SmartLingoCommunityLanguage {
  return SMARTLINGO_COMMUNITY_LANGUAGE_CODES.some(code => code === value);
}
