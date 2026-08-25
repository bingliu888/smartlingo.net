export type VocabularyLearningOrder = {
  difficulty: number;
  frequencyDegree: number;
  gradeLevel: number;
  sequence?: number;
  id?: string;
};

export function safeVocabularyGrade(value: unknown) {
  const grade = Math.floor(Number(value));
  return Number.isFinite(grade) ? Math.max(0, Math.min(12, grade)) : 0;
}

/**
 * Learning order is intentionally lexicographic: true learning difficulty is
 * primary, corpus frequency breaks difficulty ties, and the recommended
 * school grade (an age-of-acquisition proxy) breaks frequency ties.
 */
export function compareVocabularyLearningOrder(left: VocabularyLearningOrder, right: VocabularyLearningOrder) {
  return left.difficulty - right.difficulty
    || right.frequencyDegree - left.frequencyDegree
    || safeVocabularyGrade(left.gradeLevel) - safeVocabularyGrade(right.gradeLevel)
    || Number(left.sequence || 0) - Number(right.sequence || 0)
    || String(left.id || "").localeCompare(String(right.id || ""));
}

export function vocabularyGradeLabel(gradeLevel: unknown, lang: "zh" | "en") {
  const grade = safeVocabularyGrade(gradeLevel);
  if (grade === 0) return lang === "zh" ? "学段 0（幼儿园/学前）" : "Grade 0 (K/Pre-K)";
  return lang === "zh" ? `学段 ${grade}` : `Grade ${grade}`;
}
