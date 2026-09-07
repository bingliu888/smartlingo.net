// A successful answer stays locked through the feedback interval. React state
// alone cannot protect against the countdown callback from an earlier render.
export function createChallengeSubmissionGate() {
  const submitted = new Set<string>();
  return {
    acquire(question: string) {
      if (submitted.has(question)) return false;
      submitted.add(question);
      return true;
    },
    retry(question: string) {
      submitted.delete(question);
    },
  };
}
