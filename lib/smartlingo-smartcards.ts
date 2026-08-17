export type SmartCardContent = {
  id: string;
  form: string;
  pronunciation: string;
  meaningEn: string;
  meaningZh: string;
  sceneKey: string;
  difficulty: number;
};

export type SmartCardChallengeQuestion = {
  id: string;
  cardId: string;
  mode: "recognition" | "listening" | "recall" | "typing";
  promptEn: string;
  promptZh: string;
  audioText?: string;
  options?: { value: string; labelEn: string; labelZh: string }[];
};

function rotate<T>(items: readonly T[], offset: number) {
  return items.map((_, index) => items[(index + offset) % items.length]);
}

/** Deterministic options keep a versioned challenge reproducible. The server
 * still owns grading; the browser never submits scores or reward amounts. */
export function buildSmartCardChallenge(cards: readonly SmartCardContent[]): SmartCardChallengeQuestion[] {
  if (cards.length < 4) return [];
  return cards.map((card, index) => {
    const mode: SmartCardChallengeQuestion["mode"] = index === cards.length - 1
      ? "typing"
      : (["recognition", "listening", "recall"] as const)[index % 3];
    const distractors = rotate(cards.filter(item => item.id !== card.id), index + 1).slice(0, 3);
    const optionCards = rotate([card, ...distractors], index % 4);
    if (mode === "recognition" || mode === "listening") return {
      id: `q-${index + 1}-${card.id}`,
      cardId: card.id,
      mode,
      promptEn: mode === "listening" ? "Listen and choose the meaning." : card.form,
      promptZh: mode === "listening" ? "听发音并选择含义。" : card.form,
      ...(mode === "listening" ? { audioText: card.form } : {}),
      options: optionCards.map(item => ({ value: item.id, labelEn: item.meaningEn, labelZh: item.meaningZh })),
    };
    if (mode === "recall") return {
      id: `q-${index + 1}-${card.id}`,
      cardId: card.id,
      mode,
      promptEn: card.meaningEn,
      promptZh: card.meaningZh,
      options: optionCards.map(item => ({ value: item.id, labelEn: item.form, labelZh: item.form })),
    };
    return {
      id: `q-${index + 1}-${card.id}`,
      cardId: card.id,
      mode,
      promptEn: `Type: ${card.meaningEn}`,
      promptZh: `写出：${card.meaningZh}`,
    };
  });
}

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[\s.,!?！？。，、'’"“”]+/gu, "");
}

export function gradeSmartCardChallenge(cards: readonly SmartCardContent[], answers: Record<string, string>) {
  const questions = buildSmartCardChallenge(cards);
  const byId = new Map(cards.map(card => [card.id, card]));
  const correctCount = questions.reduce((count, question) => {
    const answer = String(answers[question.id] || "");
    const correct = question.mode === "typing"
      ? normalized(answer) === normalized(byId.get(question.cardId)?.form || "")
      : answer === question.cardId;
    return count + (correct ? 1 : 0);
  }, 0);
  return { correctCount, questionCount: questions.length, score: questions.length ? Math.round(correctCount * 100 / questions.length) : 0 };
}
