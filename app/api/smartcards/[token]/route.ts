import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { buildSmartCardChallenge, gradeSmartCardChallenge } from "@/lib/smartlingo-smartcards";

export const dynamic = "force-dynamic";
const COOKIE = "sl_guest_cards";

type Deck = { id: string; ownerUserId: string; ownerName: string; classId: string | null; targetLanguage: string; level: string; title: string; version: number };
type Card = { id: string; form: string; pronunciation: string; meaningEn: string; meaningZh: string; sceneKey: string; difficulty: number };

function cookieValue(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  return /^[a-f0-9]{64}$/.test(value) ? value : "";
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function guestKey(request: Request) {
  const existing = cookieValue(request);
  if (existing) return { value: existing, fresh: false };
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return { value: [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join(""), fresh: true };
}
function guestCookie(value: string) { return `${COOKIE}=${value}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`; }
function dateFor(timeZone: unknown) {
  try {
    const zone = typeof timeZone === "string" && timeZone.length <= 64 ? timeZone : "UTC";
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-");
  } catch { return new Date().toISOString().slice(0, 10); }
}
async function readDeck(token: string) {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) return null;
  const database = getDatabase();
  const deck = await database.prepare(`SELECT deck.id,deck.owner_user_id AS ownerUserId,owner.display_name AS ownerName,
    deck.class_id AS classId,deck.target_language AS targetLanguage,deck.level,deck.title,deck.version
    FROM smartlingo_smartcard_decks deck JOIN users owner ON owner.id=deck.owner_user_id
    WHERE deck.share_token=? AND deck.visibility IN ('public','unlisted') AND deck.status='active' LIMIT 1`).bind(token).first<Deck>();
  if (!deck) return null;
  const items = await database.prepare(`SELECT item.id,item.form,item.pronunciation,item.meaning_en AS meaningEn,
    item.meaning_zh AS meaningZh,item.scene_key AS sceneKey,item.difficulty
    FROM smartlingo_smartcard_items deck_item JOIN smartlingo_vocabulary_items item ON item.id=deck_item.vocabulary_item_id
    WHERE deck_item.deck_id=? AND item.review_status='published' ORDER BY deck_item.position`).bind(deck.id).run<Card>();
  return { database, deck, cards: items.results || [] };
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const value = await readDeck(token);
  if (!value) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
  const guest = guestKey(request); const guestHash = await sha256(guest.value);
  const user = await getSessionUser(request);
  const provisional = await value.database.prepare(`SELECT COALESCE(SUM(provisional_points),0) AS points
    FROM smartlingo_smartcard_guest_attempts WHERE guest_key_hash=? AND claimed_user_id IS NULL`).bind(guestHash).first<{ points: number }>();
  const response = Response.json({ deck: { ...value.deck, cards: value.cards }, challenge: buildSmartCardChallenge(value.cards), signedIn: Boolean(user), provisionalPoints: Number(provisional?.points || 0), policy: { passScore: 80, rewardPoints: 10, dailyCap: 50, pointsPerUsd: 100 } });
  if (guest.fresh) response.headers.append("set-cookie", guestCookie(guest.value));
  return response;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const value = await readDeck(token);
  if (!value) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { action?: string; answers?: Record<string, string>; timeZone?: string } | null;
  if (!body) return Response.json({ error: "Valid JSON is required" }, { status: 400 });
  const guest = guestKey(request); const guestHash = await sha256(guest.value); const now = Math.floor(Date.now() / 1000);
  const user = await getSessionUser(request);

  if (body.action === "claim") {
    if (!user) return Response.json({ error: "Sign in to claim provisional course points" }, { status: 401 });
    const pending = await value.database.prepare(`SELECT guest.id,guest.deck_id AS deckId,guest.deck_version AS deckVersion,
      guest.score,guest.correct_count AS correctCount,guest.question_count AS questionCount,guest.passed,
      guest.provisional_points AS provisionalPoints,guest.answer_fingerprint AS answerFingerprint,
      guest.local_date AS localDate,deck.owner_user_id AS ownerUserId
      FROM smartlingo_smartcard_guest_attempts guest JOIN smartlingo_smartcard_decks deck ON deck.id=guest.deck_id
      WHERE guest.guest_key_hash=? AND guest.claimed_user_id IS NULL ORDER BY guest.created_at LIMIT 200`).bind(guestHash).run<{
        id: string; deckId: string; deckVersion: number; score: number; correctCount: number; questionCount: number; passed: number; provisionalPoints: number; answerFingerprint: string; localDate: string; ownerUserId: string;
      }>();
    let claimed = 0;
    for (const attempt of pending.results || []) {
      const existing = await value.database.prepare(`SELECT COALESCE(MAX(attempt_number),0) AS maxAttempt,
        COALESCE(MAX(CASE WHEN reward_points>0 THEN 1 ELSE 0 END),0) AS rewarded
        FROM smartlingo_smartcard_challenge_attempts WHERE challenger_user_id=? AND deck_id=? AND deck_version=?`)
        .bind(user.id, attempt.deckId, attempt.deckVersion).first<{ maxAttempt: number; rewarded: number }>();
      const earnedToday = await value.database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger
        WHERE user_id=? AND entry_type='challenge_earn' AND local_date=?`).bind(user.id, attempt.localDate).first<{ points: number }>();
      const earned = !existing?.rewarded && attempt.passed && attempt.ownerUserId !== user.id && Number(earnedToday?.points || 0) <= 40 ? attempt.provisionalPoints : 0;
      const attemptId = createId();
      const statements = [];
      statements.push(value.database.prepare(`INSERT INTO smartlingo_smartcard_challenge_attempts
        (id,deck_id,deck_version,attempt_number,challenger_user_id,score,correct_count,question_count,passed,reward_points,answer_fingerprint,local_date,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(attemptId, attempt.deckId, attempt.deckVersion, Number(existing?.maxAttempt || 0) + 1, user.id, attempt.score, attempt.correctCount, attempt.questionCount, attempt.passed, earned, attempt.answerFingerprint, attempt.localDate, now));
      if (earned) statements.push(value.database.prepare(`INSERT INTO smartlingo_course_credit_ledger
        (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
        VALUES(?,?,?,'challenge_earn','smartcard_challenge',?,?,?,?)`).bind(createId(), user.id, earned, attemptId, attempt.localDate, "Claimed from a verified guest SmartCard pass", now));
      statements.push(value.database.prepare(`UPDATE smartlingo_smartcard_guest_attempts SET claimed_user_id=?,claimed_at=? WHERE id=? AND claimed_user_id IS NULL`).bind(user.id, now, attempt.id));
      try { await value.database.batch(statements); claimed += earned; } catch { /* A cap or duplicate safely leaves no redeemable credit. */ }
    }
    return Response.json({ claimedPoints: claimed });
  }

  if (body.action === "challenge") {
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    if (!value.cards.length || Object.keys(answers).length > 50) return Response.json({ error: "Challenge answers are invalid" }, { status: 400 });
    const result = gradeSmartCardChallenge(value.cards, answers);
    const score = result.score; const passed = score >= 80; const localDate = dateFor(body.timeZone);
    const prior = await value.database.prepare(`SELECT COALESCE(MAX(attempt_number),0) AS maxAttempt,
      COALESCE(MAX(CASE WHEN provisional_points>0 THEN 1 ELSE 0 END),0) AS rewarded
      FROM smartlingo_smartcard_guest_attempts WHERE guest_key_hash=? AND deck_id=? AND deck_version=?`)
      .bind(guestHash, value.deck.id, value.deck.version).first<{ maxAttempt: number; rewarded: number }>();
    const daily = await value.database.prepare(`SELECT COALESCE(SUM(provisional_points),0) AS points FROM smartlingo_smartcard_guest_attempts
      WHERE guest_key_hash=? AND local_date=?`).bind(guestHash, localDate).first<{ points: number }>();
    const points = passed && !prior?.rewarded && Number(daily?.points || 0) <= 40 ? 10 : 0;
    const fingerprint = await sha256(JSON.stringify(Object.entries(answers).sort()));
    try {
      await value.database.prepare(`INSERT INTO smartlingo_smartcard_guest_attempts
        (id,guest_key_hash,deck_id,deck_version,attempt_number,score,correct_count,question_count,passed,provisional_points,answer_fingerprint,local_date,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(createId(), guestHash, value.deck.id, value.deck.version, Number(prior?.maxAttempt || 0) + 1, score, result.correctCount, result.questionCount, passed ? 1 : 0, points, fingerprint, localDate, now).run();
    } catch { return Response.json({ error: "This challenge changed while it was being saved; retry once" }, { status: 409 }); }
    const provisional = await value.database.prepare(`SELECT COALESCE(SUM(provisional_points),0) AS points FROM smartlingo_smartcard_guest_attempts
      WHERE guest_key_hash=? AND claimed_user_id IS NULL`).bind(guestHash).first<{ points: number }>();
    const response = Response.json({ score, passed, provisionalPoints: Number(provisional?.points || 0), earnedPoints: points, claimRequired: !user });
    if (guest.fresh) response.headers.append("set-cookie", guestCookie(guest.value));
    return response;
  }
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
