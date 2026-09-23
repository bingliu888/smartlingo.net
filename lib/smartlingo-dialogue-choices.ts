type DialogueChoiceLine = {
  id: string;
  kind: "word" | "sentence";
  role?: "staff" | "learner";
  pairIndex?: number;
  form: string;
  meaningZh: string;
  meaningEn: string;
};

/**
 * Turn an authored question/answer pair into a bounded recognition challenge.
 * The bridge-language meaning makes the expected answer unambiguous even when
 * more than one natural reply would be acceptable in a real conversation.
 */
export function dialogueAnswerChoices<T extends DialogueChoiceLine>(slides: readonly T[], staffIndex: number) {
  const question = slides[staffIndex];
  const answer = slides[staffIndex + 1];
  if (question?.kind !== "sentence" || question.role !== "staff"
    || answer?.kind !== "sentence" || answer.role !== "learner"
    || question.pairIndex !== answer.pairIndex) return null;

  const candidates = slides.filter(item => item.kind === "sentence" && item.role === "learner"
    && item.id !== answer.id && item.form !== answer.form);
  const pivot = Math.max(0, Number(question.pairIndex || 0));
  const preferred = [pivot + 4, pivot + 7, pivot + 2, pivot + 5];
  const distractors: T[] = [];
  for (const offset of preferred) {
    const candidate = candidates[offset % Math.max(1, candidates.length)];
    if (candidate && !distractors.some(item => item.form === candidate.form)) distractors.push(candidate);
    if (distractors.length === 2) break;
  }
  if (distractors.length < 2) {
    for (const candidate of candidates) {
      if (!distractors.some(item => item.form === candidate.form)) distractors.push(candidate);
      if (distractors.length === 2) break;
    }
  }
  if (distractors.length < 2) return null;
  const choices = [answer, ...distractors];
  const rotation = pivot % choices.length;
  return {
    answerId: answer.id,
    answer,
    choices: [...choices.slice(rotation), ...choices.slice(0, rotation)],
  };
}
