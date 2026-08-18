"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
        };
    };
};
type Recognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: RecognitionResultEvent) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
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
    const [finalResult, setFinalResult] = useState<{
        score: number;
        claimedPoints: number;
        claimRequired: boolean;
        replayOnly: boolean;
    } | null>(null);
    const evidence = useRef<Evidence[]>([]);
    const recognitionRef = useRef<Recognition | null>(null);
    const advanceTimer = useRef<number | undefined>(undefined);
    const claimAttempted = useRef(false);
    const load = useCallback(async () => { const response = await fetch(`/api/smartcards/${encodeURIComponent(token)}`, { cache: "no-store" }); const payload = await response.json().catch(() => ({})) as Payload; if (!response.ok)
        throw new Error(payload.error); setData(payload); setPoints(payload.policy?.startingPoints || 100); }, [token]);
    useEffect(() => { const timer = window.setTimeout(() => { void load().catch(() => setMessage(zh ? "找不到这套 SmartCard。" : "This SmartCard deck is unavailable.")); }, 0); return () => { window.clearTimeout(timer); recognitionRef.current?.stop(); window.clearTimeout(advanceTimer.current); window.speechSynthesis?.cancel(); }; }, [load, zh]);
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
    const cards = useMemo(() => data?.deck?.cards || [], [data?.deck?.cards]);
    const card = cards[index] || null;
    const policy = data?.policy || { startingPoints: 100, correctPoints: 10, wrongPenalty: 5, pronunciationPoints: 5, maxAttempts: 3, pointsPerUsd: 100 };
    useEffect(() => { if (cards.length && !evidence.current.length)
        evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); }, [cards]);
    const options = useMemo(() => { if (!card)
        return []; const others = cards.filter(item => item.id !== card.id); const distractors = [0, 1, 2].map(offset => others[(index * 3 + offset) % others.length]).filter(Boolean); const values = [card, ...distractors]; const shift = index % values.length; return [...values.slice(shift), ...values.slice(0, shift)]; }, [card, cards, index]);
    function speak(text: string, onEnd?: () => void) { if (!window.speechSynthesis) {
        onEnd?.();
        return;
    } window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = speechLang[data?.deck?.targetLanguage || ""] || data?.deck?.targetLanguage || "en-US"; utterance.rate = .84; const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase())); if (voice)
        utterance.voice = voice; utterance.onend = () => onEnd?.(); utterance.onerror = () => onEnd?.(); window.speechSynthesis.resume(); window.speechSynthesis.speak(utterance); }
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
        const result = await post({ action: "check-answer", cardId: card.id, answerId });
        if (result.correct) {
            setPoints(value => value + policy.correctPoints);
            setMessage(zh ? `答对了！+${policy.correctPoints} 分，现在开口说。` : `Correct! +${policy.correctPoints}. Now say it.`);
            setPhase("speech");
            advanceTimer.current = window.setTimeout(() => speak(card.form, () => startListening()), 450);
        }
        else {
            const tries = answerTries + 1;
            setAnswerTries(tries);
            setPoints(value => Math.max(0, value - policy.wrongPenalty));
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
    function startListening() { if (!card || listening)
        return; const browser = window as typeof window & {
        SpeechRecognition?: new () => Recognition;
        webkitSpeechRecognition?: new () => Recognition;
    }; const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition; if (!Constructor) {
        setListening(false);
        setMessage(zh ? "浏览器不支持语音识别；跟读后点“我已跟读”。" : "Speech recognition is unavailable. Repeat aloud, then tap “I said it”.");
        return;
    } const recognition = new Constructor(); recognitionRef.current = recognition; recognition.lang = speechLang[data?.deck?.targetLanguage || ""] || "en-US"; recognition.continuous = false; recognition.interimResults = false; setListening(true); recognition.onresult = event => { const transcript = event.results[0]?.[0]?.transcript || ""; void checkSpeech(transcript); }; recognition.onerror = () => { setListening(false); setMessage(zh ? "没有听清楚，请再点一次麦克风。" : "I couldn't hear that. Tap the microphone and try again."); }; recognition.onend = () => setListening(false); try {
        recognition.start();
    }
    catch {
        setListening(false);
    } }
    async function checkSpeech(transcript: string) { if (!card)
        return; evidence.current[index].transcripts.push(transcript); try {
        const result = await post({ action: "check-pronunciation", cardId: card.id, transcript });
        if (result.passed) {
            setPoints(value => value + policy.pronunciationPoints);
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
    async function finish() { setPhase("complete"); setBusy(true); try {
        const result = await post({ action: "game-complete", gameMode, cards: evidence.current, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
        setPoints(Number(result.score || 0));
        setFinalResult({ score: Number(result.score || 0), claimedPoints: Number(result.claimedPoints || 0), claimRequired: Boolean(result.claimRequired), replayOnly: Boolean(result.replayOnly) });
        setMessage("");
    }
    catch {
        setMessage(zh ? "成绩暂时未保存，请重试。" : "Your result was not saved. Please retry.");
    }
    finally {
        setBusy(false);
    } }
    function replay() { evidence.current = cards.map(item => ({ cardId: item.id, choices: [], transcripts: [] })); setIndex(0); setPoints(policy.startingPoints); setAnswerTries(0); setChosenIds([]); setFlipped(false); setFinalResult(null); setPhase("answer"); setMessage(""); }
    return <main className="smart-game"><header><Link href={gameMode === "challenge" ? `/${lang}/play/challenge` : `/${lang}/smartcards`}>← {gameMode === "challenge" ? (zh ? "挑战日历" : "Challenge calendar") : (zh ? "选择其他语言" : "Choose another language")}</Link><div className="score"><span>{zh ? "课程积分" : "COURSE POINTS"}</span><strong>{points}</strong></div><p>{gameMode === "challenge" ? (zh ? "今日智慧卡挑战" : "Today's Smart Card Challenge") : (data?.deck?.title || "SmartCard")}</p></header>
    {card && phase !== "complete" ? <section className="game-board"><div className="progress"><span style={{ width: `${(index / cards.length) * 100}%` }}/><b>{index + 1} / {cards.length}</b></div><button className={`word-card ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(value => !value)}><small>{card.sceneKey}</small><strong>{flipped ? (zh ? card.meaningZh : card.meaningEn) : card.form}</strong>{flipped && card.pronunciation ? <em>{card.pronunciation}</em> : null}<span>{flipped ? (zh ? "点一下返回单词" : "Tap to see the word") : (zh ? "点一下查看意思" : "Tap to see the meaning")}</span></button>
      {phase === "answer" ? <div className="answer-step"><h2>{zh ? "这个词是什么意思？" : "What does this word mean?"}</h2><div>{options.map(option => <button key={option.id} disabled={busy || chosenIds.includes(option.id)} onClick={() => void choose(option.id)}>{zh ? option.meaningZh : option.meaningEn}</button>)}</div></div> : <div className="speech-step"><div className="coach" aria-hidden="true"><span>AI</span><i>●</i></div><div><h2>{zh ? <>请跟我说 <b>{card.form}</b></> : <>Repeat after me: <b>{card.form}</b></>}</h2><p>{listening ? (zh ? "正在听您说…" : "Listening…") : (zh ? "AI 先读，您再跟读；最多练习 3 次。" : "Listen to AI, then repeat. You have up to 3 tries.")}</p><nav><button onClick={() => speak(card.form, () => startListening())}>🔊 {zh ? "听并跟读" : "Listen & speak"}</button><button onClick={() => startListening()}>🎙 {zh ? "开始说" : "Speak now"}</button><button onClick={() => { setMessage(zh ? "已完成跟读，继续下一张。" : "Repeat complete. Moving on."); advanceTimer.current = window.setTimeout(nextCard, 500); }}>{zh ? "我已跟读" : "I said it"}</button></nav><small>{zh ? "语音只用于即时评分，不保存录音或文字。" : "Speech is scored transiently; audio and transcripts are not stored."}</small></div></div>}
      {message ? <p className="feedback" role="status">{message}</p> : null}</section> : null}
    {phase === "complete" ? <section className="finish"><span>★</span><h1>{zh ? "本轮完成！" : "Round complete!"}</h1><strong>{finalResult?.score ?? points}</strong><p>{finalResult?.claimRequired ? (zh ? "注册或登录即可把本轮积分保存到课程积分账户。" : "Sign in or create an account to save these course points.") : finalResult?.replayOnly ? (zh ? "您已领取过本卡组版本的奖励；这次成绩作为练习记录。" : "You already claimed this deck version; this replay is practice only.") : (zh ? `${finalResult?.claimedPoints || 0} 分已存入您的课程积分账户。` : `${finalResult?.claimedPoints || 0} points were saved to your course-credit account.`)}</p>{finalResult?.claimRequired ? <Link href={`/${lang}/auth/sign-up?returnTo=${encodeURIComponent(`/${lang}/smartcards/${token}`)}`}>{zh ? "免费注册并保留积分" : "Create a free account and keep points"} →</Link> : null}<button onClick={replay}>{zh ? "再玩一轮" : "Play again"}</button>{message ? <p className="feedback">{message}</p> : null}</section> : null}
    <style>{`.smart-game{min-height:100vh;padding:24px clamp(14px,4vw,52px) 70px;background:radial-gradient(circle at 85% 0,#bfffe6,transparent 30%),#f7f3ea;color:#153129}.smart-game>header,.game-board,.finish{width:min(940px,100%);margin:auto}.smart-game>header{min-height:115px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}.smart-game>header>a{color:#087d62;font-weight:850}.smart-game>header>p{grid-column:1;margin:0;color:#63766e}.score{grid-area:1/2/3;min-width:160px;padding:14px 22px;border-radius:22px;background:#123f35;color:#fff;text-align:center;box-shadow:0 13px 30px #123f3530}.score span{display:block;color:#8ff0cf;font-size:10px;font-weight:900;letter-spacing:.09em}.score strong{display:block;font-size:46px;line-height:1}.game-board,.finish{padding:clamp(18px,4vw,38px);border:1px solid #b8d2c8;border-radius:28px;background:#fff;box-shadow:0 20px 60px #163c3012}.progress{height:10px;position:relative;margin-bottom:18px;border-radius:99px;background:#e5eee9}.progress span{height:100%;display:block;border-radius:99px;background:#18b68e;transition:width .3s}.progress b{position:absolute;right:0;top:15px;color:#718078;font-size:11px}.word-card{width:100%;min-height:300px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border:0;border-radius:23px;background:linear-gradient(145deg,#123f35,#087d62);color:#fff;cursor:pointer}.word-card small{color:#90e7cb;text-transform:uppercase}.word-card strong{font-size:clamp(43px,8vw,76px);line-height:1}.word-card em{color:#c3eadd;font-size:19px}.word-card span{margin-top:25px;color:#a4e6d1;font-weight:800}.answer-step,.speech-step{margin-top:20px}.answer-step h2,.speech-step h2{font-size:22px}.answer-step>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.answer-step button,.speech-step button,.finish button,.finish a{min-height:55px;padding:12px 17px;border:1px solid #bfd3ca;border-radius:15px;background:#f0f8f4;color:#153129;font-weight:850;cursor:pointer}.answer-step button:hover{border-color:#087d62;background:#dffff2}.answer-step button:disabled{opacity:.4}.speech-step{padding:20px;display:grid;grid-template-columns:84px 1fr;gap:20px;border-radius:20px;background:#edfff7}.coach{width:76px;height:76px;display:grid;place-items:center;position:relative;border-radius:50%;background:#123f35;color:#fff;font-weight:950}.coach i{position:absolute;right:0;bottom:4px;color:#23dba9;font-size:12px}.speech-step h2{margin:0}.speech-step h2 b{color:#087d62}.speech-step p{color:#5d7169}.speech-step nav{display:flex;gap:8px;flex-wrap:wrap}.speech-step button:first-child{background:#087d62;color:#fff}.speech-step small{display:block;margin-top:12px;color:#667b72}.feedback{margin:16px 0 0;padding:13px;border-radius:13px;background:#123f35;color:#fff;font-weight:850;text-align:center}.finish{text-align:center}.finish>span{font-size:70px;color:#ffc533}.finish h1{margin:0;font-size:clamp(40px,7vw,70px)}.finish>strong{display:block;color:#087d62;font-size:clamp(70px,13vw,130px);line-height:1}.finish>p{max-width:600px;margin:10px auto 24px;color:#5c7068;font-size:18px}.finish>a,.finish>button{display:inline-flex;margin:6px;align-items:center;text-decoration:none}.finish>a{background:#087d62;color:#fff}@media(max-width:600px){.smart-game>header{grid-template-columns:1fr auto}.score{min-width:112px;padding:12px}.score strong{font-size:38px}.answer-step>div{grid-template-columns:1fr}.speech-step{grid-template-columns:1fr}.coach{width:62px;height:62px}.word-card{min-height:245px}.speech-step nav button{width:100%}}`}</style></main>;
}
