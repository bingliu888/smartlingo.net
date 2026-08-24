"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { smartCardMicrophoneFailure } from "@/lib/smartlingo-smartcards";
import { beginnerVocabularyImageKey } from "@/lib/smartlingo-vocabulary-images";
import { VocabularyPicture } from "./VocabularyPicture";
import { speakLearningText } from "@/lib/smartlingo-speech";
type Card = {
    id: string;
    form: string;
    pronunciation: string;
    targetPhonetic: string;
    pronunciationEn: string;
    pronunciationZh: string;
    pronunciationGuides: Record<string, string>;
    meaningEn: string;
    meaningZh: string;
    sceneKey: string;
};
type Policy = {
    startingPoints: number;
    correctPoints: number;
    wrongPenalty: number;
    pronunciationPoints: number;
    maxAttempts: number;
    pointsPerUsd: number;
    challengeSeconds: number;
    winnerBonusBasisPoints: number;
};
type Payload = {
    deck?: {
        title: string;
        ownerName: string;
        targetLanguage: string;
        level: string;
        dayNumber: number;
        poolSize: number;
        questionDate?: string | null;
        cards: Card[];
    };
    signedIn?: boolean;
    provisionalPoints?: number;
    practiceProgress?: {
        currentIndex: number;
        points: number;
        cards: Evidence[];
    } | null;
    policy?: Policy;
    error?: string;
};
type Evidence = {
    cardId: string;
    choices: string[];
    transcripts: string[];
};
type RecognitionResultEvent = Event & {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
            length: number;
        };
    };
};
type Recognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: RecognitionResultEvent) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort?(): void;
};
const speechLang: Record<string, string> = { en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP", ko: "ko-KR", fr: "fr-FR", de: "de-DE", ru: "ru-RU", it: "it-IT", pt: "pt-BR", ar: "ar-SA", hi: "hi-IN" };
function localCalendarDate(value = new Date()) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function PublicSmartCardChallenge({ lang, token, gameMode = "practice", dayNumber }: {
    lang: "en" | "zh";
    token: string;
    gameMode?: "practice" | "challenge";
    dayNumber?: number;
}) {
    const zh = lang === "zh";
    const [data, setData] = useState<Payload | null>(null);
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [phase, setPhase] = useState<"answer" | "speech" | "complete">("answer");
    const [points, setPoints] = useState(100);
    const [answerTries, setAnswerTries] = useState(0);
    const [chosenIds, setChosenIds] = useState<string[]>([]);
    const [selectedAnswerId, setSelectedAnswerId] = useState("");
    const [answerChecked, setAnswerChecked] = useState(false);
    const [answerResolved, setAnswerResolved] = useState(false);
    const [speechScores, setSpeechScores] = useState<number[]>([]);
    const [repeatAfterMe, setRepeatAfterMe] = useState(false);
    const [speechComplete, setSpeechComplete] = useState(false);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const [micState, setMicState] = useState<"idle" | "requesting" | "listening" | "analyzing" | "denied" | "unsupported" | "error">("idle");
    const [timeScene, setTimeScene] = useState<"dawn" | "day" | "sunset" | "night">("day");
    const [daySeed, setDaySeed] = useState(0);
    const [scoreEffect, setScoreEffect] = useState<{ id: number; amount: number } | null>(null);
    const [challengeSessionId, setChallengeSessionId] = useState("");
    const [currentLeader, setCurrentLeader] = useState<{ score: number; name: string }>({ score: 0, name: "" });
    const [challengeDeadline, setChallengeDeadline] = useState(0);
    const [countdown, setCountdown] = useState(10);
    const [finalResult, setFinalResult] = useState<{
        score: number;
        claimedPoints: number;
        claimRequired: boolean;
        replayOnly: boolean;
        currentLeaderScore?: number;
        currentLeaderName?: string;
        bonusPercent?: number;
        rewardPoints?: number;
    } | null>(null);
    const evidence = useRef<Evidence[]>([]);
    const recognitionRef = useRef<Recognition | null>(null);
    const speechCleanupRef = useRef<() => void>(() => undefined);
    const advanceTimer = useRef<number | undefined>(undefined);
    const scoreTimer = useRef<number | undefined>(undefined);
    const scoreEventId = useRef(0);
    const audioRef = useRef<AudioContext | null>(null);
    const claimAttempted = useRef(false);
    const challengeStarted = useRef(false);
    const timeoutSubmitted = useRef(false);
    const microphoneApproved = useRef(false);
    const speechAwarded = useRef(false);
    const challengeClock = useRef({ date: "", timeZone: "" });
    const apiUrl = useCallback(() => {
        if (!challengeClock.current.date) challengeClock.current.date = localCalendarDate();
        if (!challengeClock.current.timeZone) challengeClock.current.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        return `/api/smartcards/${encodeURIComponent(token)}?mode=${gameMode}${dayNumber ? `&day=${dayNumber}` : ""}&date=${challengeClock.current.date}&timeZone=${encodeURIComponent(challengeClock.current.timeZone)}`;
    },[dayNumber,gameMode,token]);
    const load = useCallback(async () => { const response = await fetch(apiUrl(), { cache: "no-store" }); const payload = await response.json().catch(() => ({})) as Payload; if (!response.ok)
        throw new Error(payload.error); setData(payload); const resume=gameMode==="practice"?payload.practiceProgress:null; setIndex(resume?.currentIndex||0); setPoints(resume?.points||payload.policy?.startingPoints||100); evidence.current=(payload.deck?.cards||[]).map((item,index)=>resume?.cards[index]?{cardId:item.id,choices:[...resume.cards[index].choices],transcripts:[]}:{cardId:item.id,choices:[],transcripts:[]}); }, [apiUrl,gameMode]);
    useEffect(() => { const timer = window.setTimeout(() => { const local = new Date(); const hour = local.getHours(); setTimeScene(hour >= 5 && hour < 10 ? "dawn" : hour >= 10 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "sunset" : "night"); setDaySeed(Math.floor(new Date(local.getFullYear(), local.getMonth(), local.getDate()).getTime() / 86400000)); void load().catch(() => setMessage(zh ? "找不到这套 SmartCard。" : "This SmartCard deck is unavailable.")); }, 0); return () => { window.clearTimeout(timer); speechCleanupRef.current(); recognitionRef.current?.stop(); window.clearTimeout(advanceTimer.current); window.clearTimeout(scoreTimer.current); window.speechSynthesis?.cancel(); void audioRef.current?.close(); }; }, [load, zh]);
    useEffect(() => {
        if (!data?.signedIn || !data.provisionalPoints || claimAttempted.current)
            return;
        claimAttempted.current = true;
        const timer = window.setTimeout(() => {
            void fetch(`/api/smartcards/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim" }) })
                .then(async response => ({ ok: response.ok, body: await response.json().catch(() => ({})) as { claimedPoints?: number } }))
                .then(result => { if (result.ok) { setData(current => current ? { ...current, provisionalPoints: 0 } : current); setMessage(zh ? `欢迎回来！${result.body.claimedPoints || 0} 分已存入课程积分。` : `Welcome back! ${result.body.claimedPoints || 0} points were saved to course credit.`); } })
                .catch(() => { claimAttempted.current = false; });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [data?.provisionalPoints, data?.signedIn, token, zh]);
    // The daily session intentionally starts once per loaded deck; action helpers are function declarations below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if(gameMode!=="challenge"||!data?.deck||challengeStarted.current)return; challengeStarted.current=true; const timer=window.setTimeout(()=>{void post({action:"challenge-start",timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).then(result=>{const sessionId=String(result.sessionId||"");setChallengeSessionId(sessionId);setCurrentLeader({score:Number(result.currentLeaderScore||0),name:String(result.currentLeaderName||"")});const currentIndex=Number(result.currentIndex||0);setIndex(Math.min(currentIndex,Math.max(0,(data.deck?.cards.length||1)-1)));setChallengeDeadline(Number(result.questionStartedMs||Date.now())+Number(result.challengeSeconds||10)*1000);if(result.completed&&sessionId)void finish(sessionId);}).catch(()=>setMessage(zh?"暂时无法开始计时挑战。":"The timed challenge is temporarily unavailable."));},0);return()=>window.clearTimeout(timer);},[data?.deck,gameMode,zh]);
    // Each index owns one server-timed question; recreating this timer is the intended dependency boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(()=>{if(gameMode!=="challenge"||phase!=="answer"||!challengeDeadline||!challengeSessionId)return;timeoutSubmitted.current=false;const tick=()=>{const left=Math.max(0,Math.ceil((challengeDeadline-Date.now())/1000));setCountdown(left);if(left===0&&!timeoutSubmitted.current){timeoutSubmitted.current=true;void choose("");}};tick();const timer=window.setInterval(tick,200);return()=>window.clearInterval(timer);},[challengeDeadline,challengeSessionId,gameMode,index,phase]);
    const cards = useMemo(() => data?.deck?.cards || [], [data?.deck?.cards]);
    const card = cards[index] || null;
    const policy = data?.policy || { startingPoints: 100, correctPoints: 10, wrongPenalty: 5, pronunciationPoints: 5, maxAttempts: 3, pointsPerUsd: 100, challengeSeconds: 10, winnerBonusBasisPoints: 1000 };
    useEffect(() => { if (cards.length && !evidence.current.length)
        evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); }, [cards]);
    const options = useMemo(() => { if (!card)
        return []; const others = cards.filter(item => item.id !== card.id); const distractors = [0, 1, 2].map(offset => others[(index * 3 + offset) % others.length]).filter(Boolean); const values = [card, ...distractors]; const shift = index % values.length; return [...values.slice(shift), ...values.slice(0, shift)]; }, [card, cards, index]);
    // Practice choices score immediately; Challenge choices score once and hold feedback for six seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(()=>{if(gameMode==="practice"&&selectedAnswerId&&!answerChecked&&!busy)void choose(selectedAnswerId);},[selectedAnswerId]);
    function speak(text: string, onEnd?: () => void, rate = .84) { speakLearningText(text,speechLang[data?.deck?.targetLanguage || ""] || data?.deck?.targetLanguage || "en-US",rate,onEnd); }
    function celebrateScore(amount: number, showPoints = true) { if(showPoints){scoreEventId.current += 1; setScoreEffect({ id: scoreEventId.current, amount }); window.clearTimeout(scoreTimer.current); scoreTimer.current = window.setTimeout(() => setScoreEffect(null), 900);} if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelector(showPoints?".score":".game-board")?.animate(amount > 0 ? [{ transform: "scale(1)" }, { transform: "scale(1.025)" }, { transform: "scale(1)" }] : [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(0)" }], { duration: 420, easing: "ease-out" }); const browser = window as typeof window & { webkitAudioContext?: typeof AudioContext }; const Audio = window.AudioContext || browser.webkitAudioContext; if (!Audio)
        return; const context = audioRef.current || new Audio(); audioRef.current = context; void context.resume(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = amount > 0 ? "sine" : "triangle"; oscillator.frequency.setValueAtTime(amount > 0 ? 620 : 190, context.currentTime); if (amount > 0)
        oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + .16); gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.11, context.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .24); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .25); }
    async function post(body: object) { const response = await fetch(apiUrl(), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})) as Record<string, unknown>; if (!response.ok)
        throw new Error(String(payload.error || "Request failed")); return payload; }
    async function nextCard() { if(gameMode==="practice"&&index+1<cards.length){setBusy(true);try{const saved=await post({action:"practice-progress",currentIndex:index+1,cards:evidence.current.slice(0,index+1)});setPoints(Number(saved.points||points));}catch{setMessage(zh?"进度暂时未保存，请再点一次继续。":"Progress was not saved. Tap Continue again.");setBusy(false);return;}setBusy(false);} setMessage(""); setFlipped(false); setAnswerTries(0); setChosenIds([]); setSelectedAnswerId(""); setAnswerChecked(false); setAnswerResolved(false); setSpeechScores([]); setSpeechComplete(false); speechAwarded.current=false; if (index + 1 < cards.length) {
        setIndex(value => value + 1);
        setPhase("answer");
    }
    else
        void finish(); }
    async function choose(answerId: string) { if (!card || busy || phase !== "answer")
        return; setBusy(true); evidence.current[index].choices.push(answerId); setChosenIds(current => [...current, answerId]); try {
        const result = await post({ action: "check-answer", cardId: card.id, answerId, gameMode, sessionId: challengeSessionId });
        if(gameMode==="challenge"){
            setAnswerChecked(true); celebrateScore(result.correct?1:-1,false); setMessage(result.correct?(zh?"答对了！6 秒后进入下一题。":"Correct! Next question in 6 seconds."):(result.timedOut?(zh?"时间到，本题失败。6 秒后继续。":"Time is up. Next question in 6 seconds."):(zh?"本题答错。6 秒后进入下一题。":"Incorrect. Next question in 6 seconds.")));
            if(result.complete)advanceTimer.current=window.setTimeout(()=>void finish(),6000);else{advanceTimer.current=window.setTimeout(()=>{setIndex(Number(result.nextIndex||index+1));setChosenIds([]);setAnswerChecked(false);setMessage("");setChallengeDeadline(Number(result.questionStartedMs||Date.now())+policy.challengeSeconds*1000);timeoutSubmitted.current=false;},6000);}
            return;
        }
        if (result.correct) {
            setPoints(value => value + policy.correctPoints);
            celebrateScore(policy.correctPoints);
            setMessage(zh ? `答对了！+${policy.correctPoints} 分。` : `Correct! +${policy.correctPoints}.`);
            setAnswerChecked(true);
            setAnswerResolved(true);
        }
        else {
            const tries = answerTries + 1;
            setAnswerTries(tries);
            setPoints(value => Math.max(0, value - policy.wrongPenalty));
            celebrateScore(-policy.wrongPenalty);
            setMessage(zh ? `再试一次！-${policy.wrongPenalty} 分（${tries}/${policy.maxAttempts}）` : `Try again! −${policy.wrongPenalty} (${tries}/${policy.maxAttempts})`);
            setAnswerChecked(true);
            setAnswerResolved(tries >= policy.maxAttempts);
        }
    }
    catch {
        setMessage(zh ? "网络暂时忙，请再点一次。" : "The network is busy. Please try again.");
    }
    finally {
        setBusy(false);
    } }
    function continueAnswer() {
        if (!card) return;
        if (!answerResolved) { setSelectedAnswerId(""); setAnswerChecked(false); return; }
        if (!repeatAfterMe) { void nextCard(); return; }
        setPhase("speech"); setSpeechScores([]); setSpeechComplete(false); setMessage(zh ? "第 1/3 次：先听示范，再跟读。" : "Attempt 1/3: listen, then repeat.");
        advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening(), .84), 250);
    }
    async function startListening() { if (!card || listening || micState === "requesting" || micState === "analyzing")
        return;
    speechCleanupRef.current();
    setMicState("requesting");
    setMessage(zh ? "正在准备麦克风…" : "Preparing the microphone…");
    if (!navigator.mediaDevices?.getUserMedia) {
        setListening(false);
        setMicState("unsupported");
        setMessage(zh ? "浏览器不支持麦克风练习；跟读后点“我已跟读”。" : "Microphone practice is unavailable. Repeat aloud, then tap “I said it”.");
        return;
    }
    let stream: MediaStream;
    try {
        if (!microphoneApproved.current && navigator.permissions?.query) {
            try {
                const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
                if (permission.state === "granted") microphoneApproved.current = true;
                else if (permission.state === "denied") throw new DOMException("Microphone access denied", "NotAllowedError");
            }
            catch (error) { if (error instanceof DOMException && error.name === "NotAllowedError") throw error; }
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneApproved.current = true;
    }
    catch (error) {
        const failure = smartCardMicrophoneFailure(error instanceof DOMException ? error.name : "");
        setListening(false);
        setMicState(failure === "denied" ? "denied" : "error");
        setMessage(failure === "denied"
            ? (zh ? "麦克风未获允许。请在浏览器的网站设置中将麦克风改为“允许”，再点“重新检查麦克风”；也可点“我已跟读”继续。" : "Microphone access was denied. Allow it in this site's browser settings, then tap “Check microphone again”, or use “I said it” to continue.")
            : (zh ? "浏览器没有打开麦克风。请检查网站权限后点“重新检查麦克风”，或点“我已跟读”继续。" : "The browser did not open the microphone. Check site permission and tap “Check microphone again”, or use “I said it” to continue."));
        return;
    }

    const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition; };
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    let recorder: MediaRecorder | null = null;
    let recognition: Recognition | null = null;
    let fallbackTimer = 0;
    let settled = false;
    const chunks: Blob[] = [];
    const stopTracks = () => stream.getTracks().forEach(track => track.stop());
    const stopRecorder = () => { if (recorder && recorder.state !== "inactive") recorder.stop(); else stopTracks(); };
    const dispose = () => {
        window.clearTimeout(fallbackTimer);
        if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; try { recognition.abort?.(); } catch { try { recognition.stop(); } catch { /* already stopped */ } } }
        if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; }
        stopRecorder();
        stopTracks();
        recognitionRef.current = null;
    };
    speechCleanupRef.current = dispose;

    const acceptNativeResult = (transcripts: string[]) => {
        if (settled || !transcripts.length) return;
        settled = true;
        dispose();
        speechCleanupRef.current = () => undefined;
        setListening(false);
        setMicState("idle");
        void checkSpeech(transcripts);
    };
    const uploadRecording = async (audio: Blob) => {
        setListening(false);
        setMicState("analyzing");
        setMessage(zh ? "正在分析发音…" : "Analyzing pronunciation…");
        const form = new FormData();
        form.set("cardId", card.id);
        form.set("audio", new File([audio], `pronunciation-${Date.now()}`, { type: audio.type || "audio/webm" }));
        try {
            const response = await fetch(`/api/smartcards/${encodeURIComponent(token)}/speech`, { method: "POST", body: form });
            const result = await response.json().catch(() => ({})) as { transcript?: string; score?: number; passed?: boolean };
            if (!response.ok || !result.transcript) throw new Error("transcription failed");
            setMicState("idle");
            await checkSpeech([result.transcript], result);
        }
        catch {
            setMicState("error");
            setMessage(zh ? "暂时无法分析发音，请点“重新检查麦克风”再试，或点“我已跟读”继续。" : "Pronunciation analysis is temporarily unavailable. Try the microphone again, or use “I said it” to continue.");
        }
    };

    if (typeof MediaRecorder !== "undefined") {
        try {
            recorder = new MediaRecorder(stream);
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onstop = () => {
                stopTracks();
                if (settled) return;
                settled = true;
                speechCleanupRef.current = () => undefined;
                const audio = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
                if (audio.size < 256) {
                    setListening(false);
                    setMicState("error");
                    setMessage(zh ? "没有听到声音，请点“重新检查麦克风”再试。" : "I couldn't hear anything. Check the microphone and try again.");
                    return;
                }
                void uploadRecording(audio);
            };
            recorder.start();
        }
        catch { recorder = null; }
    }

    if (Constructor) {
        recognition = new Constructor();
        recognitionRef.current = recognition;
        recognition.lang = speechLang[data?.deck?.targetLanguage || ""] || "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 5;
        recognition.onresult = event => {
            const result = event.results[0];
            acceptNativeResult(Array.from({ length: Math.min(result?.length || 0, 5) }, (_, position) => result?.[position]?.transcript || "").filter(Boolean));
        };
        recognition.onerror = () => { /* The timed recording remains the multilingual fallback. */ };
        recognition.onend = () => { recognitionRef.current = null; };
        try { recognition.start(); } catch { recognition = null; recognitionRef.current = null; }
    }

    setListening(true);
    setMicState("listening");
    setMessage("");
    if (!recorder) {
        stopTracks();
        if (!recognition) {
            setListening(false);
            setMicState("unsupported");
            setMessage(zh ? "浏览器不支持语音识别；跟读后点“我已跟读”。" : "Speech recognition is unavailable. Repeat aloud, then tap “I said it”.");
        }
        else fallbackTimer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            dispose();
            setListening(false);
            setMicState("error");
            setMessage(zh ? "没有听清楚，请点“重新检查麦克风”再试。" : "I couldn't hear that. Check the microphone and try again.");
        }, 6000);
        return;
    }
    fallbackTimer = window.setTimeout(() => {
        if (settled) return;
        try { recognition?.abort?.(); } catch { try { recognition?.stop(); } catch { /* already stopped */ } }
        stopRecorder();
    }, 4500);
    }
    async function checkSpeech(transcripts: string[], reviewed?: { transcript?: string; score?: number; passed?: boolean }) { if (!card || !transcripts.length)
        return; try {
        const result = reviewed?.transcript ? reviewed : await post({ action: "check-pronunciation", cardId: card.id, transcripts });
        evidence.current[index].transcripts.push(String(result.transcript || transcripts[0]));
        const tries = evidence.current[index].transcripts.length;
        const score = Number(result.score || (result.passed ? 100 : 0));
        setSpeechScores(current => [...current, score]);
        if (result.passed && !speechAwarded.current) { speechAwarded.current=true; setPoints(value => value + policy.pronunciationPoints); celebrateScore(policy.pronunciationPoints); }
        if (tries < 3) {
            setMessage(zh ? `第 ${tries}/3 次 ${score} 分。继续听示范并跟读。` : `Attempt ${tries}/3 scored ${score}. Listen and repeat again.`);
            advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening(), .84), 700);
        } else {
            setSpeechComplete(true);
            setMessage(zh ? `三次跟读完成，平均 ${Math.round([...speechScores, score].reduce((sum, item) => sum + item, 0) / 3)} 分。` : `Three attempts complete. Average ${Math.round([...speechScores, score].reduce((sum, item) => sum + item, 0) / 3)}.`);
        }
    }
    catch {
        setMessage(zh ? "暂时无法检查发音，可重试或继续。" : "Pronunciation check is unavailable; retry or continue.");
    } }
    function recordManualSpeech() {
        if (speechComplete) return;
        const nextScores=[...speechScores,0];
        setSpeechScores(nextScores);
        if(nextScores.length>=3){setSpeechComplete(true);setMessage(zh?"三次跟读已完成。当前浏览器未提供语音分数。":"Three attempts complete. This browser could not provide a speech score.");}
        else{setMessage(zh?`已记录第 ${nextScores.length}/3 次跟读。请再听示范并跟读。`:`Attempt ${nextScores.length}/3 recorded. Listen and repeat again.`);advanceTimer.current=window.setTimeout(()=>speak(card?.form||"",()=>startListening(),.84),500);}
    }
    async function finish(sessionOverride?:string) { setPhase("complete"); setBusy(true); try {
        const result = await post({ action: "game-complete", gameMode, sessionId:sessionOverride||challengeSessionId, cards: evidence.current, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        setPoints(Number(result.score || 0));
        setFinalResult({ score: Number(result.score || 0), claimedPoints: Number(result.claimedPoints || 0), claimRequired: Boolean(result.claimRequired), replayOnly: Boolean(result.replayOnly),currentLeaderScore:Number(result.currentLeaderScore||0),currentLeaderName:String(result.currentLeaderName||""),bonusPercent:Number(result.bonusPercent||0),rewardPoints:Number(result.rewardPoints||0) });
        setMessage("");
    }
    catch {
        setMessage(zh ? "成绩暂时未保存，请重试。" : "Your result was not saved. Please retry.");
    }
    finally {
        setBusy(false);
    } }
    function replay() { evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); speechAwarded.current=false; setIndex(0); setPoints(policy.startingPoints); setAnswerTries(0); setChosenIds([]); setSelectedAnswerId(""); setAnswerChecked(false); setAnswerResolved(false); setSpeechScores([]); setSpeechComplete(false); setFlipped(false); setFinalResult(null); setPhase("answer"); setMessage(""); }
    const targetLanguage = data?.deck?.targetLanguage || (token.startsWith("starter-") ? token.slice(8) : ""); const challengeLevel = data?.deck?.level === "intermediate" || data?.deck?.level === "advanced" ? data.deck.level : "beginner"; const backHref = gameMode === "challenge" ? `/${lang}/play/challenge?language=${targetLanguage}&level=${challengeLevel}` : `/${lang}/play?language=${targetLanguage}`; const hintShade=gameMode==="challenge"?"rgba(3,38,35,.44)":answerTries>=2?"rgba(5,118,75,.18)":answerTries===1?"rgba(151,92,0,.28)":"rgba(3,38,35,.4)"; const cardStyle = { backgroundImage: `linear-gradient(${hintShade},${hintShade}),url('/images/smartcards/learning-world-${timeScene}.jpg')`, backgroundPosition: `${15 + ((daySeed + index * 17) % 70)}% center`, backgroundSize: "cover", textShadow: "0 3px 14px #001",transition:"background-image .35s" } as CSSProperties;
    const beginnerPictures = data?.deck?.level === "beginner";
    return <main className="smart-game"><header><Link href={backHref}>← {gameMode === "challenge" ? (zh ? "挑战日历" : "Challenge calendar") : (zh ? "返回游戏" : "Back to games")}</Link><div className={`score ${scoreEffect ? (scoreEffect.amount > 0 ? "score-gain" : "score-loss") : ""}`}><span>{gameMode==="challenge"?(zh?"当前冠军成绩":"CURRENT WINNER"):(zh ? "课程积分" : "COURSE POINTS")}</span><strong>{gameMode==="challenge"?(currentLeader.score||"—"):points}</strong>{gameMode==="challenge"&&currentLeader.name?<small>{currentLeader.name}</small>:null}{gameMode!=="challenge"&&scoreEffect ? <i key={scoreEffect.id}>{scoreEffect.amount > 0 ? "+" : ""}{scoreEffect.amount}</i> : null}</div><p>{gameMode === "challenge" ? (zh ? `${data?.deck?.questionDate || ""} 智慧卡挑战 · ${data?.deck?.level || "beginner"} · 500 题库/当地日期固定 20 题` : `${data?.deck?.questionDate || ""} ${data?.deck?.level || "beginner"} challenge · fixed 20 of 500 for your local date`) : `${data?.deck?.title || "SmartCard"} · ${zh ? `第 ${data?.deck?.dayNumber || 1}/21 天 · 500 题库` : `Day ${data?.deck?.dayNumber || 1}/21 · 500-item pool`}`}</p>{gameMode === "practice" ? <label className="smartcard-repeat-check"><input type="checkbox" checked={repeatAfterMe} onChange={event => setRepeatAfterMe(event.target.checked)}/><span>{zh ? "三次跟读评分（默认关闭）" : "Three scored repeats (off by default)"}</span></label> : null}</header>
    {card && phase !== "complete" ? <section className="game-board"><div className="progress"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }}/><b>{index + 1} / {cards.length}</b></div><button style={cardStyle} className={`word-card scene-${timeScene} ${flipped ? "flipped" : ""}`} onClick={() => {if(gameMode!=="challenge")setFlipped(value => !value);}}><small className="card-count">{index + 1} / {cards.length}</small>{gameMode==="challenge"?<small>⏱ {countdown}s</small>:null}<strong>{flipped ? (zh ? card.meaningZh : card.meaningEn) : card.form}</strong>{flipped && card.pronunciation ? <em>{card.pronunciation}</em> : null}<span>{gameMode==="challenge"?(zh?"10 秒内选择答案 · 不提供提示":"Choose within 10 seconds · no hints"):(flipped ? (zh ? "点一下返回单词" : "Tap to see the word") : (zh ? "点一下查看意思" : "Tap to see the meaning"))}</span></button>
      {phase === "answer" ? <div className={`answer-step ${beginnerPictures ? "picture-answer-step" : ""}`}><h2>{gameMode==="challenge"?(zh?`只有一次机会 · ${countdown} 秒`:`One chance · ${countdown} seconds`):beginnerPictures?(zh?"选择与单词匹配的图片":"Choose the picture that matches the word"):(zh ? "这个词是什么意思？" : "What does this word mean?")}</h2><div>{options.map(option => <button key={option.id} aria-pressed={gameMode==="practice" && selectedAnswerId===option.id} className={gameMode==="practice" && selectedAnswerId===option.id ? "selected" : ""} disabled={busy || chosenIds.includes(option.id) || answerChecked || (gameMode==="challenge"&&!challengeSessionId)} onClick={() => gameMode==="challenge" ? void choose(option.id) : setSelectedAnswerId(option.id)}>{beginnerPictures ? <VocabularyPicture imageKey={beginnerVocabularyImageKey(option.form,option.meaningZh,option.meaningEn)} label={zh ? option.meaningZh : option.meaningEn}/> : null}<span>{zh ? option.meaningZh : option.meaningEn}</span></button>)}</div>{gameMode==="practice" ? <footer>{answerChecked ? <button type="button" disabled={busy} onClick={continueAnswer}>{busy?(zh?"保存中…":"Saving…"):(zh ? "继续" : "Continue")}</button> : null}</footer> : null}</div> : <div className="speech-step"><div className="coach" aria-hidden="true"><span>AI</span><i>●</i></div><div><h2>{zh ? <>请跟我说 <b>{card.form}</b></> : <>Repeat after me: <b>{card.form}</b></>}</h2><dl className="pronunciation-guides"><div><dt>{zh ? "目标语言音标" : "Target phonetic"}</dt><dd>{card.targetPhonetic || card.pronunciation}</dd></div><div><dt>{zh ? "当前语言助读（近似）" : "Approximate reading aid"}</dt><dd>{card.pronunciationGuides?.[lang] || (zh ? card.pronunciationZh : card.pronunciationEn) || card.pronunciation}</dd></div></dl><nav className="speech-speed"><button type="button" onClick={() => speak(card.form,undefined,.84)}>🔊 {zh ? "正常语速" : "Normal"}</button><button type="button" onClick={() => speak(card.form,undefined,.58)}>🐢 {zh ? "慢速" : "Slow"}</button></nav><div className="speech-scores">{[1,2,3].map(turn => <b className={turn <= speechScores.length ? "scored" : ""} key={turn}>{speechScores[turn-1] ?? turn}</b>)}</div><p aria-live="polite">{micState === "requesting" ? (zh ? "正在准备麦克风…" : "Preparing the microphone…") : micState === "analyzing" ? (zh ? "正在分析发音…" : "Analyzing pronunciation…") : listening ? (zh ? "正在听您说…" : "Listening…") : message || (zh ? "AI 示范后会自动听您跟读，共 3 次。" : "After each model, the microphone listens for three attempts.")}</p><nav>{micState === "denied" || micState === "error" ? <button onClick={() => { void startListening(); }}>🎙 {zh ? "重新检查麦克风" : "Check microphone again"}</button> : null}{speechComplete ? <button onClick={() => void nextCard()}>{zh ? "继续" : "Continue"}</button> : null}</nav><small>{zh ? "首次使用请选择“允许”。语音只用于即时评分，不保存录音或文字。" : "Choose Allow the first time. Speech is scored transiently; audio and transcripts are not stored."}</small></div></div>}
      {phase === "speech" && (micState === "denied" || micState === "error" || micState === "unsupported") && !speechComplete ? <button type="button" className="manual-speech" onClick={recordManualSpeech}>{zh ? "我已跟读" : "I said it"}</button> : null}
      {message && phase === "answer" ? <p className="feedback" role="status">{message}</p> : null}</section> : null}
    {phase === "complete" ? <section className="finish"><span>★</span><h1>{gameMode==="challenge"?(zh?"挑战完成！":"Challenge complete!"):(zh ? "本轮完成！" : "Round complete!")}</h1><strong>{finalResult?.score ?? points}</strong>{!finalResult?.claimRequired&&finalResult?.rewardPoints?<b className="reward-earned">{zh?`本次学习奖励 +${finalResult.rewardPoints}`:`Learning reward +${finalResult.rewardPoints}`}</b>:null}<p>{gameMode==="challenge"?(finalResult?.claimRequired?(zh?"注册或登录后，成绩才会进入今日排行榜。":"Sign in or create an account to enter today's leaderboard."):finalResult?.bonusPercent?(zh?`您超过了当时冠军；若保持第一，次日结算奖励将加成 ${finalResult.bonusPercent}%。`:`You beat the current leader. Stay first and tomorrow's winner reward gets a ${finalResult.bonusPercent}% bonus.`):(zh?"成绩已进入排行榜。次日首次有人查看日历时，将结算并奖励冠军。":"Your score is on the leaderboard. The winner is rewarded when someone first checks the calendar tomorrow.")):(finalResult?.claimRequired ? (zh ? "注册或登录即可把本轮积分保存到课程积分账户。" : "Sign in or create an account to save these course points.") : finalResult?.replayOnly ? (zh ? "您已领取过本卡组版本的奖励；这次成绩作为练习记录。" : "You already claimed this deck version; this replay is practice only.") : (zh ? `${finalResult?.claimedPoints || 0} 分已存入您的课程积分账户。` : `${finalResult?.claimedPoints || 0} points were saved to your course-credit account.`))}</p>{finalResult?.claimRequired ? <Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/smartcards/${token}${gameMode==="challenge"?"?mode=challenge":""}`)}`}>{gameMode==="challenge"?(zh?"登录并进入排行榜":"Sign in and enter ranking"):(zh ? "免费注册并保留积分" : "Create a free account and keep points")} →</Link> : null}{gameMode==="challenge"?<Link href={backHref}>{zh?"查看挑战日历":"View challenge calendar"} →</Link>:<button onClick={replay}>{zh ? "再玩一轮" : "Play again"}</button>}{message ? <p className="feedback">{message}</p> : null}</section> : null}
    <style>{`.smart-game{min-height:100vh;padding:24px clamp(14px,4vw,52px) 70px;background:radial-gradient(circle at 85% 0,#bfffe6,transparent 30%),#f7f3ea;color:#153129}.smart-game>header,.game-board,.finish{width:min(940px,100%);margin:auto}.smart-game>header{min-height:115px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.smart-game>header>a{color:#087d62;font-weight:850}.smart-game>header>p{grid-column:1;margin:0;color:#63766e}.score{grid-area:1/2/3;min-width:160px;padding:14px 22px;border-radius:22px;background:#123f35;color:#fff;text-align:center;box-shadow:0 13px 30px #123f3530}.score span{display:block;color:#8ff0cf;font-size:10px;font-weight:900;letter-spacing:.09em}.score strong{display:block;font-size:46px;line-height:1}.game-board,.finish{padding:clamp(18px,4vw,38px);border:1px solid #b8d2c8;border-radius:28px;background:#fff;box-shadow:0 20px 60px #163c3012}.progress{height:10px;position:relative;margin-bottom:18px;border-radius:99px;background:#e5eee9}.progress span{height:100%;display:block;border-radius:99px;background:#18b68e;transition:width .3s}.progress b{position:absolute;right:0;top:15px;color:#718078;font-size:11px}.word-card{width:100%;min-height:300px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border:0;border-radius:23px;background:linear-gradient(145deg,#123f35,#087d62);color:#fff;cursor:pointer}.word-card small{color:#90e7cb;text-transform:uppercase}.word-card strong{font-size:clamp(43px,8vw,76px);line-height:1}.word-card em{color:#c3eadd;font-size:19px}.word-card span{margin-top:25px;color:#a4e6d1;font-weight:800}.answer-step,.speech-step{margin-top:20px}.answer-step h2,.speech-step h2{font-size:22px}.answer-step>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.answer-step button,.speech-step button,.finish button,.finish a{min-height:55px;padding:12px 17px;border:1px solid #bfd3ca;border-radius:15px;background:#f0f8f4;color:#153129;font-weight:850;cursor:pointer}.answer-step button:hover{border-color:#087d62;background:#dffff2}.answer-step button:disabled{opacity:.4}.speech-step{padding:20px;display:grid;grid-template-columns:84px 1fr;gap:20px;border-radius:20px;background:#edfff7}.coach{width:76px;height:76px;display:grid;place-items:center;position:relative;border-radius:50%;background:#123f35;color:#fff;font-weight:950}.coach i{position:absolute;right:0;bottom:4px;color:#23dba9;font-size:12px}.speech-step h2{margin:0}.speech-step h2 b{color:#087d62}.pronunciation-guides{margin:12px 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.pronunciation-guides div{min-width:0;padding:9px 11px;border:1px solid #c5e5d9;border-radius:12px;background:#fff}.pronunciation-guides dt{color:#527067;font-size:11px;font-weight:850}.pronunciation-guides dd{margin:3px 0 0;overflow-wrap:anywhere;color:#123f35;font-size:17px;font-weight:850}.speech-step p{color:#5d7169}.speech-step nav{display:flex;gap:8px;flex-wrap:wrap}.speech-step button:first-child{background:#087d62;color:#fff}.speech-step small{display:block;margin-top:12px;color:#667b72}.feedback{margin:16px 0 0;padding:13px;border-radius:13px;background:#123f35;color:#fff;font-weight:850;text-align:center}.finish{text-align:center}.finish>span{font-size:70px;color:#ffc533}.finish h1{margin:0;font-size:clamp(40px,7vw,70px)}.finish>strong{display:block;color:#087d62;font-size:clamp(70px,13vw,130px);line-height:1}.finish>p{max-width:600px;margin:10px auto 24px;color:#5c7068;font-size:18px}.finish>a,.finish>button{display:inline-flex;margin:6px;align-items:center;text-decoration:none}.finish>a{background:#087d62;color:#fff}@media(max-width:600px){.smart-game>header{grid-template-columns:1fr auto}.score{min-width:112px;padding:12px}.score strong{font-size:38px}.answer-step>div,.pronunciation-guides{grid-template-columns:1fr}.speech-step{grid-template-columns:1fr}.coach{width:62px;height:62px}.word-card{min-height:245px}.speech-step nav button{width:100%}}`}</style><style>{`.smartcard-repeat-check{grid-column:1;display:flex;align-items:center;gap:8px;color:#49675d;font-size:13px;font-weight:850}.smartcard-repeat-check input{width:18px;height:18px;accent-color:#087d62}.picture-answer-step>div{grid-template-columns:repeat(2,minmax(0,1fr))}.picture-answer-step>div>button{display:grid;grid-template-columns:112px 1fr;align-items:center;gap:14px;text-align:left}.picture-answer-step .vocabulary-picture{width:112px;height:112px;display:block;border-radius:16px;background-color:#e8f5ef}@media(max-width:600px){.picture-answer-step>div{grid-template-columns:1fr}.picture-answer-step>div>button{grid-template-columns:88px 1fr}.picture-answer-step .vocabulary-picture{width:88px;height:88px}}`}</style></main>;
}
