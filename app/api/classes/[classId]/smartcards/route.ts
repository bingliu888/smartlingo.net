import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { buildSmartCardChallenge, gradeSmartCardChallenge } from "@/lib/smartlingo-smartcards";

export const dynamic = "force-dynamic";

type Course = { id: string; targetLanguage: string; level: string; packageTier: string | null };
type DeckRow = {
  id: string; ownerUserId: string; ownerName: string; classId: string; targetLanguage: string;
  level: string; title: string; version: number; visibility: string; shareToken: string;
  itemCount: number; bestScore: number | null; createdAt: number;
};
type CardRow = { id: string; form: string; pronunciation: string; meaningEn: string; meaningZh: string; sceneKey: string; difficulty: number; frequencyDegree: number; gradeLevel: number };

function dateFor(timeZone: unknown) {
  try {
    const zone = typeof timeZone === "string" && timeZone.length <= 64 ? timeZone : "UTC";
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-");
  } catch { return new Date().toISOString().slice(0, 10); }
}

async function courseAccess(request: Request, classId: string) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) } as const;
  const database = getDatabase();
  const course = await database.prepare(`SELECT id,target_language AS targetLanguage,level,package_tier AS packageTier
    FROM smartlingo_language_classes WHERE id=? AND class_kind='official_course' AND status='open' LIMIT 1`)
    .bind(classId).first<Course>();
  if (!course) return { error: Response.json({ error: "Course not found" }, { status: 404 }) } as const;
  const member = await database.prepare(`SELECT 1 FROM smartlingo_language_class_members member
    LEFT JOIN smartlingo_course_subscriptions subscription ON subscription.class_id=member.class_id AND subscription.user_id=member.user_id
    WHERE member.class_id=? AND member.user_id=? AND member.status='active'
      AND (member.role IN ('owner','teacher','coordinator') OR subscription.status='active'
        OR (subscription.status='trialing' AND subscription.trial_ends_at>unixepoch())) LIMIT 1`)
    .bind(classId, user.id).first();
  if (!member) return { error: Response.json({ error: "Active course access is required" }, { status: 403 }) } as const;
  return { user, database, course } as const;
}

async function deckItems(database: ReturnType<typeof getDatabase>, deckId: string) {
  const result = await database.prepare(`SELECT item.id,item.form,item.pronunciation,
    item.meaning_en AS meaningEn,item.meaning_zh AS meaningZh,item.scene_key AS sceneKey,item.difficulty,item.frequency_degree AS frequencyDegree,item.grade_level AS gradeLevel
    FROM smartlingo_smartcard_items deck_item
    JOIN smartlingo_vocabulary_items item ON item.id=deck_item.vocabulary_item_id
    WHERE deck_item.deck_id=? ORDER BY deck_item.position`).bind(deckId).run<CardRow>();
  return result.results || [];
}

async function publicDecks(database: ReturnType<typeof getDatabase>, classId: string, userId: string) {
  const result = await database.prepare(`SELECT deck.id,deck.owner_user_id AS ownerUserId,owner.display_name AS ownerName,
    deck.class_id AS classId,deck.target_language AS targetLanguage,deck.level,deck.title,deck.version,
    deck.visibility,deck.share_token AS shareToken,deck.created_at AS createdAt,
    COUNT(DISTINCT deck_item.vocabulary_item_id) AS itemCount,MAX(attempt.score) AS bestScore
    FROM smartlingo_smartcard_decks deck JOIN users owner ON owner.id=deck.owner_user_id
    LEFT JOIN smartlingo_smartcard_items deck_item ON deck_item.deck_id=deck.id
    LEFT JOIN smartlingo_smartcard_challenge_attempts attempt ON attempt.deck_id=deck.id AND attempt.challenger_user_id=?
    WHERE deck.class_id=? AND deck.status='active' AND (deck.owner_user_id=? OR deck.visibility='public')
    GROUP BY deck.id ORDER BY (deck.owner_user_id=?) DESC,deck.updated_at DESC LIMIT 24`)
    .bind(userId, classId, userId, userId).run<DeckRow>();
  return result.results || [];
}

async function balance(database: ReturnType<typeof getDatabase>, userId: string) {
  const row = await database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger WHERE user_id=?`)
    .bind(userId).first<{ points: number }>();
  return Number(row?.points || 0);
}

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const access = await courseAccess(request, classId);
  if ("error" in access) return access.error;
  const decks = await publicDecks(access.database, classId, access.user.id);
  const withCards = await Promise.all(decks.map(async deck => {
    const cards = await deckItems(access.database, deck.id);
    return { ...deck, cards, challenge: buildSmartCardChallenge(cards) };
  }));
  const curriculum = await access.database.prepare(`SELECT level,cefr_band AS cefrBand,cumulative_item_target AS cumulativeItemTarget,
    productive_item_target AS productiveItemTarget,goal_en AS goalEn,goal_zh AS goalZh,methodology_version AS methodologyVersion
    FROM smartlingo_curriculum_levels ORDER BY CASE level WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END`).run();
  return Response.json({
    decks: withCards,
    balancePoints: await balance(access.database, access.user.id),
    policy: { pointsPerUsd: 100, passScore: 80, rewardPoints: 10, dailyEarnCap: 50, maxMonthlyRedemptionPercent: 100 },
    curriculum: curriculum.results || [],
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const access = await courseAccess(request, classId);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null) as { action?: string; title?: string; deckId?: string; answers?: Record<string, string>; timeZone?: string } | null;
  if (!body) return Response.json({ error: "Valid JSON is required" }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);

  if (body.action === "generate") {
    const title = String(body.title || "").trim().slice(0, 80) || `${access.course.targetLanguage.toUpperCase()} SmartCards`;
    const level = access.course.packageTier === "advanced" ? "advanced" : access.course.packageTier === "intermediate" ? "intermediate" : "beginner";
    const vocabulary = await access.database.prepare(`SELECT id FROM smartlingo_vocabulary_items
      WHERE target_language=? AND review_status='published' AND level IN (?, 'beginner')
      ORDER BY CASE level WHEN ? THEN 0 ELSE 1 END, difficulty, frequency_degree DESC, grade_level ASC, sequence LIMIT 12`)
      .bind(access.course.targetLanguage, level, level).run<{ id: string }>();
    const cards = vocabulary.results || [];
    if (cards.length < 4) return Response.json({ error: "Reviewed vocabulary is not ready for this course yet" }, { status: 409 });
    const deckId = createId();
    const shareToken = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`.slice(0, 48);
    await access.database.batch([
      access.database.prepare(`INSERT INTO smartlingo_smartcard_decks
        (id,owner_user_id,class_id,target_language,level,title,version,visibility,share_token,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,1,'public',?,'active',?,?)`)
        .bind(deckId, access.user.id, classId, access.course.targetLanguage, level, title, shareToken, now, now),
      ...cards.map((card, position) => access.database.prepare(`INSERT INTO smartlingo_smartcard_items(deck_id,vocabulary_item_id,position) VALUES(?,?,?)`)
        .bind(deckId, card.id, position)),
    ]);
    return Response.json({ created: true, deckId, shareToken }, { status: 201 });
  }

  if (body.action === "challenge") {
    const deckId = String(body.deckId || "");
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    const deck = await access.database.prepare(`SELECT id,owner_user_id AS ownerUserId,version FROM smartlingo_smartcard_decks
      WHERE id=? AND class_id=? AND status='active' AND (visibility='public' OR owner_user_id=?) LIMIT 1`)
      .bind(deckId, classId, access.user.id).first<{ id: string; ownerUserId: string; version: number }>();
    if (!deck) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
    const cards = await deckItems(access.database, deck.id);
    if (cards.length < 1 || Object.keys(answers).length > 50) return Response.json({ error: "Challenge answers are invalid" }, { status: 400 });
    const result = gradeSmartCardChallenge(cards, answers);
    const { correctCount, score } = result;
    const passed = score >= 80;
    const localDate = dateFor(body.timeZone);
    const prior = await access.database.prepare(`SELECT COALESCE(MAX(attempt_number),0) AS maxAttempt,
      COALESCE(MAX(CASE WHEN reward_points>0 THEN 1 ELSE 0 END),0) AS rewarded
      FROM smartlingo_smartcard_challenge_attempts WHERE challenger_user_id=? AND deck_id=? AND deck_version=?`)
      .bind(access.user.id, deck.id, deck.version).first<{ maxAttempt: number; rewarded: number }>();
    const daily = await access.database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger
      WHERE user_id=? AND entry_type='challenge_earn' AND local_date=?`).bind(access.user.id, localDate).first<{ points: number }>();
    const rewardPoints = passed && !prior?.rewarded && deck.ownerUserId !== access.user.id && Number(daily?.points || 0) <= 40 ? 10 : 0;
    const attemptNumber = Number(prior?.maxAttempt || 0) + 1;
    const attemptId = createId();
    const fingerprintBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(Object.entries(answers).sort())));
    const fingerprint = [...new Uint8Array(fingerprintBytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    const statements = [access.database.prepare(`INSERT INTO smartlingo_smartcard_challenge_attempts
      (id,deck_id,deck_version,attempt_number,challenger_user_id,score,correct_count,question_count,passed,reward_points,answer_fingerprint,local_date,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(attemptId, deck.id, deck.version, attemptNumber, access.user.id, score, correctCount, cards.length, passed ? 1 : 0, rewardPoints, fingerprint, localDate, now)];
    if (rewardPoints) statements.push(access.database.prepare(`INSERT INTO smartlingo_course_credit_ledger
      (id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
      VALUES(?,?,10,'challenge_earn','smartcard_challenge',?,?,?,?)`)
      .bind(createId(), access.user.id, attemptId, localDate, "First verified pass for this SmartCard version", now));
    try {
      await access.database.batch(statements);
    } catch {
      return Response.json({ error: "This challenge changed while it was being saved; retry once" }, { status: 409 });
    }
    return Response.json({ score, correctCount, questionCount: cards.length, passed, rewardPoints, balancePoints: await balance(access.database, access.user.id) });
  }

  return Response.json({ error: "Unsupported SmartCard action" }, { status: 400 });
}
