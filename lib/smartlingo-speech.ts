export const SMARTLINGO_NORMAL_SPEECH_RATE = .84;
export const SMARTLINGO_SLOW_SPEECH_RATE = .42;

export function learningSpeechRate(requestedRate = SMARTLINGO_NORMAL_SPEECH_RATE) {
  return requestedRate <= .65
    ? SMARTLINGO_SLOW_SPEECH_RATE
    : Math.max(.75, Math.min(1, requestedRate));
}

export function speakLearningText(text: string, locale: string, requestedRate = SMARTLINGO_NORMAL_SPEECH_RATE, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
    onEnd?.();
    return () => undefined;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const appliedRate = learningSpeechRate(requestedRate);
  utterance.lang = locale || "en-US";
  utterance.rate = appliedRate;
  utterance.pitch = appliedRate === SMARTLINGO_SLOW_SPEECH_RATE ? .88 : 1;
  utterance.volume = 1;
  let settled = false;
  let watchdog: number | undefined;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(watchdog);
    onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  // Safari can reuse the cancelled utterance's rate when a new utterance is
  // queued synchronously. A short queue boundary makes Normal/Slow distinct.
  const queueTimer = window.setTimeout(() => {
    const language = utterance.lang.slice(0, 2).toLowerCase();
    const voice = synth.getVoices().find(item => item.lang.toLowerCase().startsWith(language));
    if (voice) utterance.voice = voice;
    synth.resume();
    synth.speak(utterance);
    const estimatedMs = Math.max(3500, Array.from(text).length * 420 / appliedRate + 2200);
    watchdog = window.setTimeout(() => { synth.cancel(); finish(); }, Math.min(30000, estimatedMs));
  }, 120);
  return () => {
    window.clearTimeout(queueTimer);
    window.clearTimeout(watchdog);
    settled = true;
    synth.cancel();
  };
}
