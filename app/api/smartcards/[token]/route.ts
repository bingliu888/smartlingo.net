import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { scoreSmartCardPronunciation } from "@/lib/smartlingo-smartcards";

export const dynamic = "force-dynamic";
const COOKIE = "sl_guest_cards";
const POLICY = { startingPoints: 100, correctPoints: 10, wrongPenalty: 5, pronunciationPoints: 5, maxAttempts: 3, pointsPerUsd: 100, challengeSeconds: 5, winnerBonusBasisPoints: 1000 } as const;

type Deck = { id: string; ownerUserId: string; ownerName: string; classId: string | null; targetLanguage: string; level: string; title: string; version: number };
type Card = { id: string; form: string; pronunciation: string; meaningEn: string; meaningZh: string; sceneKey: string; difficulty: number };
type Evidence = { cardId?: unknown; choices?: unknown; transcripts?: unknown };
type TimedSession = { id:string; localDate:string; currentIndex:number; correctCount:number; questionStartedMs:number; completedAt:number|null };
type Leader = { score:number; displayName:string };

function cookieValue(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  return /^[a-f0-9]{64}$/.test(value) ? value : "";
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function guestKey(request: Request) {
  const existing = cookieValue(request); if (existing) return { value: existing, fresh: false };
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return { value: [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join(""), fresh: true };
}
function guestCookie(value: string) { return `${COOKIE}=${value}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`; }
function withCookie(response: Response, guest: { value: string; fresh: boolean }) { if (guest.fresh) response.headers.append("set-cookie", guestCookie(guest.value)); return response; }
function dateFor(timeZone: unknown) {
  try { const zone = typeof timeZone === "string" && timeZone.length <= 64 ? timeZone : "UTC"; return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-"); }
  catch { return new Date().toISOString().slice(0, 10); }
}
async function readDeck(token: string) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) return null;
  const database = getDatabase();
  const deck = await database.prepare(`SELECT deck.id,deck.owner_user_id AS ownerUserId,owner.display_name AS ownerName,deck.class_id AS classId,deck.target_language AS targetLanguage,deck.level,deck.title,deck.version FROM smartlingo_smartcard_decks deck JOIN users owner ON owner.id=deck.owner_user_id WHERE deck.share_token=? AND deck.visibility IN ('public','unlisted') AND deck.status='active' LIMIT 1`).bind(token).first<Deck>();
  if (!deck) return null;
  const items = await database.prepare(`SELECT item.id,item.form,item.pronunciation,item.meaning_en AS meaningEn,item.meaning_zh AS meaningZh,item.scene_key AS sceneKey,item.difficulty FROM smartlingo_smartcard_items deck_item JOIN smartlingo_vocabulary_items item ON item.id=deck_item.vocabulary_item_id WHERE deck_item.deck_id=? AND item.review_status='published' ORDER BY deck_item.position`).bind(deck.id).run<Card>();
  return { database, deck, cards: items.results || [] };
}

async function claimGameRewards(value: NonNullable<Awaited<ReturnType<typeof readDeck>>>, guestHash: string, userId: string, now: number) {
  let claimed = 0;
  const games = await value.database.prepare(`SELECT run.id,run.deck_id AS deckId,run.deck_version AS deckVersion,run.game_mode AS gameMode,run.score,run.local_date AS localDate,deck.owner_user_id AS ownerUserId FROM smartlingo_smartcard_game_runs run JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id WHERE run.guest_key_hash=? AND run.claim_status='pending' ORDER BY run.created_at LIMIT 200`).bind(guestHash).run<{ id: string; deckId: string; deckVersion: number; gameMode: "practice"|"challenge"; score: number; localDate: string; ownerUserId: string }>();
  for (const game of games.results || []) {
    const prior = await value.database.prepare(`SELECT id FROM smartlingo_smartcard_game_runs WHERE claimed_user_id=? AND deck_id=? AND deck_version=? AND game_mode=? AND (?='challenge' AND local_date=? OR ?='practice') LIMIT 1`).bind(userId,game.deckId,game.deckVersion,game.gameMode,game.gameMode,game.localDate,game.gameMode).first<{ id:string }>();
    if (prior || game.ownerUserId === userId || game.score <= 0) {
      await value.database.prepare(`UPDATE smartlingo_smartcard_game_runs SET claim_status='ineligible',claimed_at=?,updated_at=? WHERE id=? AND claim_status='pending'`).bind(now,now,game.id).run().catch(() => undefined); continue;
    }
    if (game.gameMode === "challenge") {
      try { await value.database.prepare(`UPDATE smartlingo_smartcard_game_runs SET claim_status='claimed',claimed_user_id=?,claimed_at=?,updated_at=? WHERE id=? AND claim_status='pending'`).bind(userId,now,now,game.id).run(); } catch { /* Duplicate daily claims stay ineligible. */ }
      continue;
    }
    try {
      await value.database.batch([
        value.database.prepare(`UPDATE smartlingo_smartcard_game_runs SET claim_status='claimed',claimed_user_id=?,claimed_at=?,updated_at=? WHERE id=? AND claim_status='pending'`).bind(userId,now,now,game.id),
        value.database.prepare(`INSERT INTO smartlingo_course_credit_ledger (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at) VALUES(?,?,?,'smartcard_game_earn','smartcard_game',?,?,?,?)`).bind(createId(),userId,game.score,game.id,game.localDate,"Completed public SmartCard game",now),
      ]); claimed += game.score;
    } catch { /* Duplicate and invalid rewards remain non-redeemable. */ }
  }
  return claimed;
}

async function claimLegacyRewards(value: NonNullable<Awaited<ReturnType<typeof readDeck>>>, guestHash: string, userId: string, now: number) {
  let claimed = 0;
  const pending = await value.database.prepare(`SELECT guest.id,guest.deck_id AS deckId,guest.deck_version AS deckVersion,guest.score,guest.correct_count AS correctCount,guest.question_count AS questionCount,guest.passed,guest.provisional_points AS provisionalPoints,guest.answer_fingerprint AS answerFingerprint,guest.local_date AS localDate,deck.owner_user_id AS ownerUserId FROM smartlingo_smartcard_guest_attempts guest JOIN smartlingo_smartcard_decks deck ON deck.id=guest.deck_id WHERE guest.guest_key_hash=? AND guest.claimed_user_id IS NULL ORDER BY guest.created_at LIMIT 200`).bind(guestHash).run<{ id: string; deckId: string; deckVersion: number; score: number; correctCount: number; questionCount: number; passed: number; provisionalPoints: number; answerFingerprint: string; localDate: string; ownerUserId: string }>();
  for (const attempt of pending.results || []) {
    const existing = await value.database.prepare(`SELECT COALESCE(MAX(attempt_number),0) AS maxAttempt,COALESCE(MAX(CASE WHEN reward_points>0 THEN 1 ELSE 0 END),0) AS rewarded FROM smartlingo_smartcard_challenge_attempts WHERE challenger_user_id=? AND deck_id=? AND deck_version=?`).bind(userId,attempt.deckId,attempt.deckVersion).first<{ maxAttempt: number; rewarded: number }>();
    const daily = await value.database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger WHERE user_id=? AND entry_type='challenge_earn' AND local_date=?`).bind(userId,attempt.localDate).first<{ points: number }>();
    const earned = !existing?.rewarded && attempt.passed && attempt.ownerUserId !== userId && Number(daily?.points || 0) <= 40 ? attempt.provisionalPoints : 0; const attemptId = createId();
    const statements = [value.database.prepare(`INSERT INTO smartlingo_smartcard_challenge_attempts (id,deck_id,deck_version,attempt_number,challenger_user_id,score,correct_count,question_count,passed,reward_points,answer_fingerprint,local_date,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(attemptId,attempt.deckId,attempt.deckVersion,Number(existing?.maxAttempt||0)+1,userId,attempt.score,attempt.correctCount,attempt.questionCount,attempt.passed,earned,attempt.answerFingerprint,attempt.localDate,now)];
    if (earned) statements.push(value.database.prepare(`INSERT INTO smartlingo_course_credit_ledger (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at) VALUES(?,?,?,'challenge_earn','smartcard_challenge',?,?,?,?)`).bind(createId(),userId,earned,attemptId,attempt.localDate,"Claimed from a verified guest SmartCard pass",now));
    statements.push(value.database.prepare(`UPDATE smartlingo_smartcard_guest_attempts SET claimed_user_id=?,claimed_at=? WHERE id=? AND claimed_user_id IS NULL`).bind(userId,now,attempt.id));
    try { await value.database.batch(statements); claimed += earned; } catch { /* Legacy duplicate/cap. */ }
  }
  return claimed;
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const value = await readDeck((await params).token); if (!value) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
  const guest = guestKey(request); const guestHash = await sha256(guest.value); const user = await getSessionUser(request);
  const pending = await value.database.prepare(`SELECT COALESCE(SUM(score),0) AS points FROM smartlingo_smartcard_game_runs WHERE guest_key_hash=? AND game_mode='practice' AND claim_status='pending'`).bind(guestHash).first<{ points: number }>();
  return withCookie(Response.json({ deck: { ...value.deck, cards: value.cards }, signedIn: Boolean(user), provisionalPoints: Number(pending?.points || 0), policy: POLICY }), guest);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const value = await readDeck((await params).token); if (!value) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { action?: string; cardId?: string; answerId?: string; transcript?: string; cards?: Evidence[]; timeZone?: string; gameMode?: string; sessionId?: string } | null;
  if (!body) return Response.json({ error: "Valid JSON is required" }, { status: 400 });
  const guest = guestKey(request); const guestHash = await sha256(guest.value); const user = await getSessionUser(request); const nowMs = Date.now(); const now = Math.floor(nowMs / 1000);
  const card = value.cards.find(item => item.id === body.cardId);
  if (body.action === "challenge-start") {
    const localDate = new Date(nowMs).toISOString().slice(0,10); let session = await value.database.prepare(`SELECT id,local_date AS localDate,current_index AS currentIndex,correct_count AS correctCount,question_started_ms AS questionStartedMs,completed_at AS completedAt FROM smartlingo_smartcard_timed_sessions WHERE guest_key_hash=? AND deck_id=? AND deck_version=? AND local_date=? LIMIT 1`).bind(guestHash,value.deck.id,value.deck.version,localDate).first<TimedSession>();
    if (!session) { const id=createId(); await value.database.prepare(`INSERT INTO smartlingo_smartcard_timed_sessions(id,guest_key_hash,deck_id,deck_version,local_date,current_index,correct_count,question_started_ms,created_at,updated_at) VALUES(?,?,?,?,?,0,0,?,?,?)`).bind(id,guestHash,value.deck.id,value.deck.version,localDate,nowMs,now,now).run(); session={id,localDate,currentIndex:0,correctCount:0,questionStartedMs:nowMs,completedAt:null}; }
    const leader = await value.database.prepare(`SELECT run.score,user.display_name AS displayName FROM smartlingo_smartcard_game_runs run JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id JOIN users user ON user.id=run.claimed_user_id WHERE run.game_mode='challenge' AND run.claim_status='claimed' AND run.local_date=? AND deck.target_language=? ORDER BY run.score DESC,run.updated_at ASC LIMIT 1`).bind(localDate,value.deck.targetLanguage).first<Leader>();
    return withCookie(Response.json({ sessionId:session.id,currentIndex:session.currentIndex,correctCount:session.correctCount,questionStartedMs:session.questionStartedMs,completed:Boolean(session.completedAt),currentLeaderScore:Number(leader?.score||0),currentLeaderName:leader?.displayName||"",challengeSeconds:POLICY.challengeSeconds }),guest);
  }
  if (body.action === "check-answer" && body.gameMode === "challenge") {
    if (!body.sessionId || typeof body.answerId !== "string") return withCookie(Response.json({ error:"Timed challenge evidence is required" },{status:400}),guest);
    const session = await value.database.prepare(`SELECT id,local_date AS localDate,current_index AS currentIndex,correct_count AS correctCount,question_started_ms AS questionStartedMs,completed_at AS completedAt FROM smartlingo_smartcard_timed_sessions WHERE id=? AND guest_key_hash=? AND deck_id=? AND deck_version=? LIMIT 1`).bind(body.sessionId,guestHash,value.deck.id,value.deck.version).first<TimedSession>();
    const expected = session ? value.cards[session.currentIndex] : null;
    if (!session || session.completedAt || !expected || expected.id!==body.cardId) return withCookie(Response.json({ error:"This challenge question is no longer active" },{status:409}),guest);
    const timedOut=nowMs-session.questionStartedMs>POLICY.challengeSeconds*1000; const correct=!timedOut&&body.answerId===expected.id; const nextIndex=session.currentIndex+1; const complete=nextIndex>=value.cards.length;
    await value.database.prepare(`UPDATE smartlingo_smartcard_timed_sessions SET current_index=?,correct_count=correct_count+?,question_started_ms=?,completed_at=?,updated_at=? WHERE id=? AND current_index=? AND completed_at IS NULL`).bind(nextIndex,correct?1:0,nowMs,complete?now:null,now,session.id,session.currentIndex).run();
    return withCookie(Response.json({ correct,timedOut,nextIndex,complete,questionStartedMs:nowMs }),guest);
  }
  if (body.action === "check-answer") return withCookie(card && typeof body.answerId === "string" ? Response.json({ correct: body.answerId === card.id }) : Response.json({ error: "Card answer is invalid" }, { status: 400 }), guest);
  if (body.action === "check-pronunciation") {
    if (!card || typeof body.transcript !== "string" || body.transcript.length > 160) return withCookie(Response.json({ error: "Pronunciation sample is invalid" }, { status: 400 }), guest);
    return withCookie(Response.json(scoreSmartCardPronunciation(card.form, body.transcript)), guest);
  }
  if (body.action === "claim") {
    if (!user) return withCookie(Response.json({ error: "Sign in to claim provisional course points" }, { status: 401 }), guest);
    const claimedPoints = await claimGameRewards(value,guestHash,user.id,now) + await claimLegacyRewards(value,guestHash,user.id,now);
    return withCookie(Response.json({ claimedPoints }), guest);
  }
  if (body.action === "game-complete") {
    if (body.gameMode === "challenge") {
      if (!body.sessionId) return withCookie(Response.json({ error:"Timed challenge session is required" },{status:400}),guest);
      const session=await value.database.prepare(`SELECT id,local_date AS localDate,current_index AS currentIndex,correct_count AS correctCount,question_started_ms AS questionStartedMs,completed_at AS completedAt FROM smartlingo_smartcard_timed_sessions WHERE id=? AND guest_key_hash=? AND deck_id=? AND deck_version=? LIMIT 1`).bind(body.sessionId,guestHash,value.deck.id,value.deck.version).first<TimedSession>();
      if(!session||!session.completedAt||session.currentIndex!==value.cards.length)return withCookie(Response.json({error:"Complete the timed challenge before finishing"},{status:400}),guest);
      const score=Math.round(session.correctCount*100/value.cards.length); const leader=await value.database.prepare(`SELECT run.score,user.display_name AS displayName FROM smartlingo_smartcard_game_runs run JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id JOIN users user ON user.id=run.claimed_user_id WHERE run.game_mode='challenge' AND run.claim_status='claimed' AND run.local_date=? AND deck.target_language=? ORDER BY run.score DESC,run.updated_at ASC LIMIT 1`).bind(session.localDate,value.deck.targetLanguage).first<Leader>();
      const bonusBasisPoints=leader&&leader.score<100&&score>leader.score?POLICY.winnerBonusBasisPoints:0; const fingerprint=await sha256(`${session.id}:${session.correctCount}:${value.cards.length}`); const id=createId();
      await value.database.prepare(`INSERT INTO smartlingo_smartcard_game_runs (id,guest_key_hash,deck_id,deck_version,game_mode,score,correct_count,question_count,pronunciation_passes,answer_fingerprint,local_date,leader_bonus_basis_points,created_at,updated_at) VALUES(?,?,?,?, 'challenge',?,?,?,?,?,?,?, ?,?) ON CONFLICT(guest_key_hash,deck_id,deck_version,game_mode,local_date) DO UPDATE SET score=MAX(score,excluded.score),correct_count=CASE WHEN excluded.score>score THEN excluded.correct_count ELSE correct_count END,answer_fingerprint=CASE WHEN excluded.score>score THEN excluded.answer_fingerprint ELSE answer_fingerprint END,leader_bonus_basis_points=CASE WHEN excluded.score>score THEN excluded.leader_bonus_basis_points ELSE leader_bonus_basis_points END,updated_at=CASE WHEN excluded.score>score THEN excluded.updated_at ELSE updated_at END`).bind(id,guestHash,value.deck.id,value.deck.version,score,session.correctCount,value.cards.length,0,fingerprint,session.localDate,bonusBasisPoints,now,now).run();
      const claimedPoints=user?await claimGameRewards(value,guestHash,user.id,now):0;
      return withCookie(Response.json({score,correctCount:session.correctCount,questionCount:value.cards.length,currentLeaderScore:Number(leader?.score||0),currentLeaderName:leader?.displayName||"",bonusPercent:bonusBasisPoints/100,claimedPoints,claimRequired:!user,replayOnly:false}),guest);
    }
    if (!Array.isArray(body.cards) || body.cards.length !== value.cards.length || value.cards.length < 4 || value.cards.length > 50) return withCookie(Response.json({ error: "Complete every card once before finishing the game" }, { status: 400 }), guest);
    let correctCount = 0; let wrongCount = 0; let pronunciationPasses = 0; const safeEvidence: { cardId: string; choices: string[]; speechScores: number[] }[] = [];
    for (let index = 0; index < value.cards.length; index += 1) {
      const expected = value.cards[index]; const submitted = body.cards[index];
      if (submitted?.cardId !== expected.id || !Array.isArray(submitted.choices) || !Array.isArray(submitted.transcripts) || submitted.choices.length > POLICY.maxAttempts || submitted.transcripts.length > POLICY.maxAttempts) return withCookie(Response.json({ error: "Game evidence is invalid" }, { status: 400 }), guest);
      const choices = submitted.choices.filter((choice): choice is string => typeof choice === "string" && value.cards.some(item => item.id === choice));
      const transcripts = submitted.transcripts.filter((item): item is string => typeof item === "string" && item.length <= 160);
      if (choices.length !== submitted.choices.length || transcripts.length !== submitted.transcripts.length || choices.length < 1) return withCookie(Response.json({ error: "Game evidence is invalid" }, { status: 400 }), guest);
      const correctAt = choices.indexOf(expected.id); if (correctAt >= 0) correctCount += 1; wrongCount += correctAt >= 0 ? correctAt : choices.length;
      const speechScores = transcripts.map(item => scoreSmartCardPronunciation(expected.form,item).score); if (speechScores.some(score => score >= 85)) pronunciationPasses += 1;
      safeEvidence.push({ cardId: expected.id, choices, speechScores });
    }
    const score = Math.max(0,Math.min(850,POLICY.startingPoints + correctCount * POLICY.correctPoints - wrongCount * POLICY.wrongPenalty + pronunciationPasses * POLICY.pronunciationPoints));
    const fingerprint = await sha256(JSON.stringify(safeEvidence)); const localDate = dateFor(body.timeZone); const id = createId(); const gameMode=body.gameMode==="challenge"?"challenge":"practice";
    await value.database.prepare(`INSERT INTO smartlingo_smartcard_game_runs (id,guest_key_hash,deck_id,deck_version,game_mode,score,correct_count,question_count,pronunciation_passes,answer_fingerprint,local_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(guest_key_hash,deck_id,deck_version,game_mode,local_date) DO UPDATE SET score=MAX(score,excluded.score),correct_count=CASE WHEN excluded.score>score THEN excluded.correct_count ELSE correct_count END,pronunciation_passes=CASE WHEN excluded.score>score THEN excluded.pronunciation_passes ELSE pronunciation_passes END,answer_fingerprint=CASE WHEN excluded.score>score THEN excluded.answer_fingerprint ELSE answer_fingerprint END,updated_at=excluded.updated_at`).bind(id,guestHash,value.deck.id,value.deck.version,gameMode,score,correctCount,value.cards.length,pronunciationPasses,fingerprint,localDate,now,now).run();
    const claimedPoints = user ? await claimGameRewards(value,guestHash,user.id,now) : 0;
    return withCookie(Response.json({ score,correctCount,pronunciationPasses,claimedPoints,claimRequired:!user,replayOnly:Boolean(user&&claimedPoints===0) }), guest);
  }
  return withCookie(Response.json({ error: "Unsupported action" }, { status: 400 }), guest);
}
