export type AssistantTurnSource = "typed" | "voice";

export type AssistantVoiceResult = {
  transcript: string;
  isFinal: boolean;
};

export type AssistantVoiceUpdate = {
  draft: string;
  finalContent: string | null;
};

export type AssistantVoiceTurn = {
  applyResults(results: readonly AssistantVoiceResult[]): AssistantVoiceUpdate | null;
  finish(): string | null;
  cancel(): void;
  fail(): void;
};

export function assistantReplyShouldSpeak(source: AssistantTurnSource) {
  return source === "voice";
}

function joinTranscript(parts: readonly string[]) {
  return parts.map(part => part.trim()).filter(Boolean).join(" ");
}

export function createAssistantVoiceTurn(baseDraft = ""): AssistantVoiceTurn {
  const base = baseDraft.trim();
  let active = true;
  let consumed = false;
  let latestDraft = base;
  let latestFinalContent = "";

  function closeWith(content: string) {
    if (!active || consumed) return null;
    active = false;
    consumed = true;
    return content.trim() || null;
  }

  return {
    applyResults(results) {
      if (!active || consumed) return null;
      const transcript = joinTranscript(results.map(result => result.transcript));
      const finalTranscript = joinTranscript(results.filter(result => result.isFinal).map(result => result.transcript));
      latestDraft = joinTranscript([base, transcript]);
      latestFinalContent = finalTranscript ? joinTranscript([base, finalTranscript]) : "";
      const finalResult = results.at(-1);
      const shouldSubmit = Boolean(finalResult?.isFinal && finalTranscript);
      return {
        draft: latestDraft,
        finalContent: shouldSubmit ? closeWith(latestFinalContent) : null,
      };
    },
    finish() {
      const content = latestFinalContent ? closeWith(latestFinalContent) : null;
      if (!content) {
        active = false;
        consumed = true;
      }
      return content;
    },
    cancel() {
      active = false;
      consumed = true;
    },
    fail() {
      active = false;
      consumed = true;
    },
  };
}

export function clearStaleAssistantDraft(currentDraft: string, submittedDraft: string, submittedRevision: number, currentRevision: number) {
  if (currentRevision !== submittedRevision) return currentDraft;
  return currentDraft.trim() === submittedDraft.trim() ? "" : currentDraft;
}
