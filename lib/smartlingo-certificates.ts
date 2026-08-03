export type SmartLingoCertificateRow = {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  enrollmentId: string;
  userId: string;
  classId: string;
  memberName: string;
  memberEmail?: string;
  courseTitleZh: string;
  courseTitleEn: string;
  targetLanguage: string;
  level: "beginner" | "intermediate" | "advanced";
  durationDays: number;
  startDay: number;
  completedDays: number;
  finalScore: number;
  passScore: number;
  completionReason: "course_complete" | "early_mastery" | "exam_pass";
  curriculumVersion: string;
  issuedAt: number;
};

export const SMARTLINGO_CERTIFICATE_SELECT = `SELECT cert.id,
  cert.certificate_number AS certificateNumber,
  cert.verification_code AS verificationCode,
  cert.enrollment_id AS enrollmentId,
  cert.user_id AS userId,
  cert.class_id AS classId,
  cert.member_name AS memberName,
  cert.course_title_zh AS courseTitleZh,
  cert.course_title_en AS courseTitleEn,
  cert.target_language AS targetLanguage,
  cert.level AS level,
  cert.duration_days AS durationDays,
  cert.start_day AS startDay,
  cert.completed_days AS completedDays,
  cert.final_score AS finalScore,
  cert.pass_score AS passScore,
  cert.completion_reason AS completionReason,
  cert.curriculum_version AS curriculumVersion,
  cert.issued_at AS issuedAt
  FROM smartlingo_course_certificates_v2 cert`;

export const SMARTLINGO_LANGUAGE_NAMES: Record<string, { zh: string; en: string }> = {
  zh: { zh: "中文", en: "Chinese" },
  en: { zh: "英语", en: "English" },
  es: { zh: "西班牙语", en: "Spanish" },
  ja: { zh: "日语", en: "Japanese" },
  ko: { zh: "韩语", en: "Korean" },
  fr: { zh: "法语", en: "French" },
  de: { zh: "德语", en: "German" },
  ru: { zh: "俄语", en: "Russian" },
  it: { zh: "意大利语", en: "Italian" },
  pt: { zh: "葡萄牙语", en: "Portuguese" },
  ar: { zh: "阿拉伯语", en: "Arabic" },
  hi: { zh: "印地语", en: "Hindi" },
};

export function certificateCourseName(certificate: SmartLingoCertificateRow, lang: "zh" | "en") {
  return lang === "zh" ? certificate.courseTitleZh : certificate.courseTitleEn;
}

export function certificateLanguageName(code: string, lang: "zh" | "en") {
  return SMARTLINGO_LANGUAGE_NAMES[code]?.[lang] || code.toUpperCase();
}
