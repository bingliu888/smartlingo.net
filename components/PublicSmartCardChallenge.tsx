"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { smartCardMicrophoneFailure } from "@/lib/smartlingo-smartcards";
type Card = {
    id: string;
    form: string;
    pronunciation: string;
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
        cards: Card[];
    };
    signedIn?: boolean;
    provisionalPoints?: number;
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
export function PublicSmartCardChallenge({ lang, token, gameMode = "practice" }: {
    lang: "en" | "zh";
    token: string;
    gameMode?: "practice" | "challenge";
}) {
    const zh = lang === "zh";
    const [data, setData] = useState<Payload | null>(null);
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [phase, setPhase] = useState<"answer" | "speech" | "complete">("answer");
    const [points, setPoints] = useState(100);
    const [answerTries, setAnswerTries] = useState(0);
    const [chosenIds, setChosenIds] = useState<string[]>([]);
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
    const [countdown, setCountdown] = useState(5);
    const [finalResult, setFinalResult] = useState<{
        score: number;
        claimedPoints: number;
        claimRequired: boolean;
        replayOnly: boolean;
        currentLeaderScore?: number;
        currentLeaderName?: string;
        bonusPercent?: number;
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
    const load = useCallback(async () => { const response = await fetch(`/api/smartcards/${encodeURIComponent(token)}`, { cache: "no-store" }); const payload = await response.json().catch(() => ({})) as Payload; if (!response.ok)
        throw new Error(payload.error); setData(payload); setPoints(payload.policy?.startingPoints || 100); }, [token]);
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
    useEffect(() => { if(gameMode!=="challenge"||!data?.deck||challengeStarted.current)return; challengeStarted.current=true; const timer=window.setTimeout(()=>{void post({action:"challenge-start",timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).then(result=>{const sessionId=String(result.sessionId||"");setChallengeSessionId(sessionId);setCurrentLeader({score:Number(result.currentLeaderScore||0),name:String(result.currentLeaderName||"")});const currentIndex=Number(result.currentIndex||0);setIndex(Math.min(currentIndex,Math.max(0,(data.deck?.cards.length||1)-1)));setChallengeDeadline(Number(result.questionStartedMs||Date.now())+Number(result.challengeSeconds||5)*1000);if(result.completed&&sessionId)void finish(sessionId);}).catch(()=>setMessage(zh?"暂时无法开始计时挑战。":"The timed challenge is temporarily unavailable."));},0);return()=>window.clearTimeout(timer);},[data?.deck,gameMode,zh]);
    // Each index owns one server-timed question; recreating this timer is the intended dependency boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(()=>{if(gameMode!=="challenge"||phase!=="answer"||!challengeDeadline||!challengeSessionId)return;timeoutSubmitted.current=false;const tick=()=>{const left=Math.max(0,Math.ceil((challengeDeadline-Date.now())/1000));setCountdown(left);if(left===0&&!timeoutSubmitted.current){timeoutSubmitted.current=true;void choose("");}};tick();const timer=window.setInterval(tick,200);return()=>window.clearInterval(timer);},[challengeDeadline,challengeSessionId,gameMode,index,phase]);
    const cards = useMemo(() => data?.deck?.cards || [], [data?.deck?.cards]);
    const card = cards[index] || null;
    const policy = data?.policy || { startingPoints: 100, correctPoints: 10, wrongPenalty: 5, pronunciationPoints: 5, maxAttempts: 3, pointsPerUsd: 100, challengeSeconds: 5, winnerBonusBasisPoints: 1000 };
    useEffect(() => { if (cards.length && !evidence.current.length)
        evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); }, [cards]);
    const options = useMemo(() => { if (!card)
        return []; const others = cards.filter(item => item.id !== card.id); const distractors = [0, 1, 2].map(offset => others[(index * 3 + offset) % others.length]).filter(Boolean); const values = [card, ...distractors]; const shift = index % values.length; return [...values.slice(shift), ...values.slice(0, shift)]; }, [card, cards, index]);
    function speak(text: string, onEnd?: () => void) { if (!window.speechSynthesis) {
        onEnd?.();
        return;
    } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = speechLang[data?.deck?.targetLanguage || ""] || data?.deck?.targetLanguage || "en-US"; utterance.rate = .84; const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase())); if (voice)
        utterance.voice = voice; utterance.onend = () => onEnd?.(); utterance.onerror = () => onEnd?.(); window.speechSynthesis.resume(); window.speechSynthesis.speak(utterance); }
    function celebrateScore(amount: number, showPoints = true) { if(showPoints){scoreEventId.current += 1; setScoreEffect({ id: scoreEventId.current, amount }); window.clearTimeout(scoreTimer.current); scoreTimer.current = window.setTimeout(() => setScoreEffect(null), 900);} if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelector(showPoints?".score":".game-board")?.animate(amount > 0 ? [{ transform: "scale(1)" }, { transform: "scale(1.025)" }, { transform: "scale(1)" }] : [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(7px)" }, { transform: "translateX(0)" }], { duration: 420, easing: "ease-out" }); const browser = window as typeof window & { webkitAudioContext?: typeof AudioContext }; const Audio = window.AudioContext || browser.webkitAudioContext; if (!Audio)
        return; const context = audioRef.current || new Audio(); audioRef.current = context; void context.resume(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = amount > 0 ? "sine" : "triangle"; oscillator.frequency.setValueAtTime(amount > 0 ? 620 : 190, context.currentTime); if (amount > 0)
        oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + .16); gain.gain.setValueAtTime(.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.11, context.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .24); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .25); }
    async function post(body: object) { const response = await fetch(`/api/smartcards/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json().catch(() => ({})) as Record<string, unknown>; if (!response.ok)
        throw new Error(String(payload.error || "Request failed")); return payload; }
    function nextCard() { setMessage(""); setFlipped(false); setAnswerTries(0); setChosenIds([]); if (index + 1 < cards.length) {
        setIndex(value => value + 1);
        setPhase("answer");
    }
    else
        void finish(); }
    async function choose(answerId: string) { if (!card || busy || phase !== "answer")
        return; setBusy(true); evidence.current[index].choices.push(answerId); setChosenIds(current => [...current, answerId]); try {
        const result = await post({ action: "check-answer", cardId: card.id, answerId, gameMode, sessionId: challengeSessionId });
        if(gameMode==="challenge"){
            celebrateScore(result.correct?1:-1,false); setMessage(result.correct?(zh?"答对了！":"Correct!"):(result.timedOut?(zh?"时间到，本题失败。":"Time is up. Question failed."):(zh?"本题答错，继续下一题。":"Incorrect. Moving to the next question.")));
            if(result.complete)advanceTimer.current=window.setTimeout(()=>void finish(),450);else{setIndex(Number(result.nextIndex||index+1));setChosenIds([]);setChallengeDeadline(Number(result.questionStartedMs||Date.now())+policy.challengeSeconds*1000);timeoutSubmitted.current=false;advanceTimer.current=window.setTimeout(()=>setMessage(""),700);}
            return;
        }
        if (result.correct) {
            setPoints(value => value + policy.correctPoints);
            celebrateScore(policy.correctPoints);
            setMessage(zh ? `答对了！+${policy.correctPoints} 分，现在开口说。` : `Correct! +${policy.correctPoints}. Now say it.`);
            setPhase("speech");
            advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening()), 450);
        }
        else {
            const tries = answerTries + 1;
            setAnswerTries(tries);
            setPoints(value => Math.max(0, value - policy.wrongPenalty));
            celebrateScore(-policy.wrongPenalty);
            setMessage(zh ? `再试一次！-${policy.wrongPenalty} 分（${tries}/${policy.maxAttempts}）` : `Try again! −${policy.wrongPenalty} (${tries}/${policy.maxAttempts})`);
            if (tries >= policy.maxAttempts) {
                setPhase("speech");
                advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening()), 800);
            }
        }
    }
    catch {
        setMessage(zh ? "网络暂时忙，请再点一次。" : "The network is busy. Please try again.");
    }
    finally {
        setBusy(false);
    } }
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
        if (result.passed) {
            setPoints(value => value + policy.pronunciationPoints);
            celebrateScore(policy.pronunciationPoints);
            setMessage(zh ? `发音很好！+${policy.pronunciationPoints} 分` : `Nice pronunciation! +${policy.pronunciationPoints}`);
            advanceTimer.current = window.setTimeout(nextCard, 900);
        }
        else {
            const tries = evidence.current[index].transcripts.length;
            if (tries < policy.maxAttempts) {
                setMessage(zh ? `再清楚一点，我们重来（${tries}/${policy.maxAttempts}）。` : `A little clearer. Let's try again (${tries}/${policy.maxAttempts}).`);
                advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening()), 700);
            }
            else {
                setMessage(zh ? "练习完成，继续下一张！" : "Practice complete—on to the next card!");
                advanceTimer.current = window.setTimeout(nextCard, 900);
            }
        }
    }
    catch {
        setMessage(zh ? "暂时无法检查发音，可重试或继续。" : "Pronunciation check is unavailable; retry or continue.");
    } }
    async function finish(sessionOverride?:string) { setPhase("complete"); setBusy(true); try {
        const result = await post({ action: "game-complete", gameMode, sessionId:sessionOverride||challengeSessionId, cards: evidence.current, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        setPoints(Number(result.score || 0));
        setFinalResult({ score: Number(result.score || 0), claimedPoints: Number(result.claimedPoints || 0), claimRequired: Boolean(result.claimRequired), replayOnly: Boolean(result.replayOnly),currentLeaderScore:Number(result.currentLeaderScore||0),currentLeaderName:String(result.currentLeaderName||""),bonusPercent:Number(result.bonusPercent||0) });
        setMessage("");
    }
    catch {
        setMessage(zh ? "成绩暂时未保存，请重试。" : "Your result was not saved. Please retry.");
    }
    finally {
        setBusy(false);
    } }
    function replay() { evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); setIndex(0); setPoints(policy.startingPoints); setAnswerTries(0); setChosenIds([]); setFlipped(false); setFinalResult(null); setPhase("answer"); setMessage(""); }
    const targetLanguage = data?.deck?.targetLanguage || (token.startsWith("starter-") ? token.slice(8) : ""); const backHref = gameMode === "challenge" ? `/${lang}/play/challenge?language=${targetLanguage}` : `/${lang}/play?language=${targetLanguage}`; const hintShade=gameMode==="challenge"?"rgba(3,38,35,.44)":answerTries>=2?"rgba(5,118,75,.18)":answerTries===1?"rgba(151,92,0,.28)":"rgba(3,38,35,.4)"; const cardStyle = { backgroundImage: `linear-gradient(${hintShade},${hintShade}),url('/images/smartcards/learning-world-${timeScene}.jpg')`, backgroundPosition: `${15 + ((daySeed + index * 17) % 70)}% center`, backgroundSize: "cover", textShadow: "0 3px 14px #001",transition:"background-image .35s" } as CSSProperties;
    return <main className="smart-game"><header><Link href={backHref}>← {gameMode === "challenge" ? (zh ? "挑战日历" : "Challenge calendar") : (zh ? "返回游戏" : "Back to games")}</Link><div className={`score ${scoreEffect ? (scoreEffect.amount > 0 ? "score-gain" : "score-loss") : ""}`}><span>{gameMode==="challenge"?(zh?"当前冠军成绩":"CURRENT WINNER"):(zh ? "课程积分" : "COURSE POINTS")}</span><strong>{gameMode==="challenge"?(currentLeader.score||"—"):points}</strong>{gameMode==="challenge"&&currentLeader.name?<small>{currentLeader.name}</small>:null}{gameMode!=="challenge"&&scoreEffect ? <i key={scoreEffect.id}>{scoreEffect.amount > 0 ? "+" : ""}{scoreEffect.amount}</i> : null}</div><p>{gameMode === "challenge" ? (zh ? "今日智慧卡挑战 · 每题一次机会" : "Today's challenge · one chance per question") : (data?.deck?.title || "SmartCard")}</p></header>
    {card && phase !== "complete" ? <section className="game-board"><div className="progress"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }}/><b>{index + 1} / {cards.length}</b></div><button style={cardStyle} className={`word-card scene-${timeScene} ${flipped ? "flipped" : ""}`} onClick={() => {if(gameMode!=="challenge")setFlipped(value => !value);}}><small className="card-count">{index + 1} / {cards.length}</small>{gameMode==="challenge"?<small>⏱ {countdown}s</small>:null}<small>{card.sceneKey}</small><strong>{flipped ? (zh ? card.meaningZh : card.meaningEn) : card.form}</strong>{flipped && card.pronunciation ? <em>{card.pronunciation}</em> : null}<span>{gameMode==="challenge"?(zh?"5 秒内选择答案 · 不提供提示":"Choose within 5 seconds · no hints"):(flipped ? (zh ? "点一下返回单词" : "Tap to see the word") : (zh ? "点一下查看意思" : "Tap to see the meaning"))}</span></button>
      {phase === "answer" ? <div className="answer-step"><h2>{gameMode==="challenge"?(zh?`只有一次机会 · ${countdown} 秒`:`One chance · ${countdown} seconds`):(zh ? "这个词是什么意思？" : "What does this word mean?")}</h2><div>{options.map(option => <button key={option.id} disabled={busy || chosenIds.includes(option.id) || (gameMode==="challenge"&&!challengeSessionId)} onClick={() => void choose(option.id)}>{zh ? option.meaningZh : option.meaningEn}</button>)}</div></div> : <div className="speech-step"><div className="coach" aria-hidden="true"><span>AI</span><i>●</i></div><div><h2>{zh ? <>请跟我说 <b>{card.form}</b></> : <>Repeat after me: <b>{card.form}</b></>}</h2><p aria-live="polite">{micState === "requesting" ? (zh ? "正在准备麦克风…" : "Preparing the microphone…") : micState === "analyzing" ? (zh ? "正在分析发音…" : "Analyzing pronunciation…") : listening ? (zh ? "正在听您说…" : "Listening…") : (zh ? "AI 读完后会自动听您跟读；最多练习 3 次。" : "After AI speaks, the microphone listens automatically. You have up to 3 tries.")}</p><nav>{micState === "denied" || micState === "error" ? <button onClick={() => { void startListening(); }}>🎙 {zh ? "重新检查麦克风" : "Check microphone again"}</button> : null}<button onClick={() => { speechCleanupRef.current(); setListening(false); setMessage(zh ? "已完成跟读，继续下一张。" : "Repeat complete. Moving on."); advanceTimer.current = window.setTimeout(nextCard, 500); }}>{zh ? "我已跟读" : "I said it"}</button></nav><small>{zh ? "首次使用请选择“允许”。语音只用于即时评分，不保存录音或文字。" : "Choose Allow the first time. Speech is scored transiently; audio and transcripts are not stored."}</small></div></div>}
      {message ? <p className="feedback" role="status">{message}</p> : null}</section> : null}
    {phase === "complete" ? <section className="finish"><span>★</span><h1>{gameMode==="challenge"?(zh?"挑战完成！":"Challenge complete!"):(zh ? "本轮完成！" : "Round complete!")}</h1><strong>{finalResult?.score ?? points}</strong><p>{gameMode==="challenge"?(finalResult?.claimRequired?(zh?"注册或登录后，成绩才会进入今日排行榜。":"Sign in or create an account to enter today's leaderboard."):finalResult?.bonusPercent?(zh?`您超过了当时冠军；若保持第一，次日结算奖励将加成 ${finalResult.bonusPercent}%。`:`You beat the current leader. Stay first and tomorrow's winner reward gets a ${finalResult.bonusPercent}% bonus.`):(zh?"成绩已进入排行榜。次日首次有人查看日历时，将结算并奖励冠军。":"Your score is on the leaderboard. The winner is rewarded when someone first checks the calendar tomorrow.")):(finalResult?.claimRequired ? (zh ? "注册或登录即可把本轮积分保存到课程积分账户。" : "Sign in or create an account to save these course points.") : finalResult?.replayOnly ? (zh ? "您已领取过本卡组版本的奖励；这次成绩作为练习记录。" : "You already claimed this deck version; this replay is practice only.") : (zh ? `${finalResult?.claimedPoints || 0} 分已存入您的课程积分账户。` : `${finalResult?.claimedPoints || 0} points were saved to your course-credit account.`))}</p>{finalResult?.claimRequired ? <Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/smartcards/${token}${gameMode==="challenge"?"?mode=challenge":""}`)}`}>{gameMode==="challenge"?(zh?"登录并进入排行榜":"Sign in and enter ranking"):(zh ? "免费注册并保留积分" : "Create a free account and keep points")} →</Link> : null}{gameMode==="challenge"?<Link href={backHref}>{zh?"查看挑战日历":"View challenge calendar"} →</Link>:<button onClick={replay}>{zh ? "再玩一轮" : "Play again"}</button>}{message ? <p className="feedback">{message}</p> : null}</section> : null}
    <style>{`.smart-game{min-height:100vh;padding:24px clamp(14px,4vw,52px) 70px;background:radial-gradient(circle at 85% 0,#bfffe6,transparent 30%),#f7f3ea;color:#153129}.smart-game>header,.game-board,.finish{width:min(940px,100%);margin:auto}.smart-game>header{min-height:115px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.smart-game>header>a{color:#087d62;font-weight:850}.smart-game>header>p{grid-column:1;margin:0;color:#63766e}.score{grid-area:1/2/3;min-width:160px;padding:14px 22px;border-radius:22px;background:#123f35;color:#fff;text-align:center;box-shadow:0 13px 30px #123f3530}.score span{display:block;color:#8ff0cf;font-size:10px;font-weight:900;letter-spacing:.09em}.score strong{display:block;font-size:46px;line-height:1}.game-board,.finish{padding:clamp(18px,4vw,38px);border:1px solid #b8d2c8;border-radius:28px;background:#fff;box-shadow:0 20px 60px #163c3012}.progress{height:10px;position:relative;margin-bottom:18px;border-radius:99px;background:#e5eee9}.progress span{height:100%;display:block;border-radius:99px;background:#18b68e;transition:width .3s}.progress b{position:absolute;right:0;top:15px;color:#718078;font-size:11px}.word-card{width:100%;min-height:300px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border:0;border-radius:23px;background:linear-gradient(145deg,#123f35,#087d62);color:#fff;cursor:pointer}.word-card small{color:#90e7cb;text-transform:uppercase}.word-card strong{font-size:clamp(43px,8vw,76px);line-height:1}.word-card em{color:#c3eadd;font-size:19px}.word-card span{margin-top:25px;color:#a4e6d1;font-weight:800}.answer-step,.speech-step{margin-top:20px}.answer-step h2,.speech-step h2{font-size:22px}.answer-step>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.answer-step button,.speech-step button,.finish button,.finish a{min-height:55px;padding:12px 17px;border:1px solid #bfd3ca;border-radius:15px;background:#f0f8f4;color:#153129;font-weight:850;cursor:pointer}.answer-step button:hover{border-color:#087d62;background:#dffff2}.answer-step button:disabled{opacity:.4}.speech-step{padding:20px;display:grid;grid-template-columns:84px 1fr;gap:20px;border-radius:20px;background:#edfff7}.coach{width:76px;height:76px;display:grid;place-items:center;position:relative;border-radius:50%;background:#123f35;color:#fff;font-weight:950}.coach i{position:absolute;right:0;bottom:4px;color:#23dba9;font-size:12px}.speech-step h2{margin:0}.speech-step h2 b{color:#087d62}.speech-step p{color:#5d7169}.speech-step nav{display:flex;gap:8px;flex-wrap:wrap}.speech-step button:first-child{background:#087d62;color:#fff}.speech-step small{display:block;margin-top:12px;color:#667b72}.feedback{margin:16px 0 0;padding:13px;border-radius:13px;background:#123f35;color:#fff;font-weight:850;text-align:center}.finish{text-align:center}.finish>span{font-size:70px;color:#ffc533}.finish h1{margin:0;font-size:clamp(40px,7vw,70px)}.finish>strong{display:block;color:#087d62;font-size:clamp(70px,13vw,130px);line-height:1}.finish>p{max-width:600px;margin:10px auto 24px;color:#5c7068;font-size:18px}.finish>a,.finish>button{display:inline-flex;margin:6px;align-items:center;text-decoration:none}.finish>a{background:#087d62;color:#fff}@media(max-width:600px){.smart-game>header{grid-template-columns:1fr auto}.score{min-width:112px;padding:12px}.score strong{font-size:38px}.answer-step>div{grid-template-columns:1fr}.speech-step{grid-template-columns:1fr}.coach{width:62px;height:62px}.word-card{min-height:245px}.speech-step nav button{width:100%}}`}</style></main>;
}
