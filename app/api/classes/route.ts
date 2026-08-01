import { createId, getDatabase, getSessionUser } from "../../../lib/auth";
import { cleanMultiline, cleanText } from "../../../lib/smartlingo-classes";
import { quoteClassOrder } from "../../../lib/smartlingo-commerce";

export const dynamic = "force-dynamic";

type LanguagePathRow = {
  id: string;
  slug: string;
  targetLanguage: string;
  level: string;
  titleEn: string;
  titleZh: string;
  version: string;
};

type LanguageClassRow = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  pathId: string;
  pathTitleEn: string;
  pathTitleZh: string;
  classKind: "official_language" | "member_language" | "subject";
  ownerRole: "teacher" | "coordinator";
  title: string;
  summary: string;
  targetLanguage: string;
  level: string;
  schedule: string;
  status: string;
  visibility: string;
  priceCents: number;
  currency: string;
  capacity: number;
  enrollmentCount: number;
  membershipRole: "owner" | "teacher" | "coordinator" | "student" | null;
  membershipStatus: "invited" | "active" | "paused" | "left" | "removed" | null;
  createdAt: number;
};

type LanguageClassView = LanguageClassRow & {
  isOwner: boolean;
  isJoined: boolean;
  canJoin: boolean;
};

type ConnectedAccountRow = {
  onboardingStatus: string;
  chargesEnabled: number;
  payoutsEnabled: number;
  requirementsDue: string;
};

function normalizeCapacity(value: unknown) {
  const capacity = Math.floor(Number(value));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 1_000) {
    throw new Error("Capacity must be between 1 and 1,000 learners.");
  }
  return capacity;
}

function normalizePriceCents(value: unknown) {
  const priceCents = Math.floor(Number(value));
  if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 10_000_000) {
    throw new Error("Price must be between 0 and 100,000 USD.");
  }
  return priceCents;
}

function parseRequirements(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function classView(row: LanguageClassRow, userId: string): LanguageClassView {
  const isOwner = row.ownerUserId === userId || row.membershipRole === "owner";
  const isJoined = !isOwner && ["active", "invited", "paused"].includes(row.membershipStatus || "");
  return {
    ...row,
    enrollmentCount: Number(row.enrollmentCount || 0),
    isOwner,
    isJoined,
    canJoin: !isOwner
      && !isJoined
      && row.visibility === "public"
      && row.status === "open"
      && row.priceCents === 0
      && Number(row.enrollmentCount || 0) < row.capacity,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  const database = getDatabase();
  const [pathResult, classResult, connectedAccount] = await Promise.all([
    database.prepare(`SELECT id, slug, target_language AS targetLanguage, level,
      title_en AS titleEn, title_zh AS titleZh, version
      FROM smartlingo_language_paths
      WHERE status = 'published'
      ORDER BY CASE target_language
        WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3
        WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7
        WHEN 'it' THEN 8 WHEN 'pt' THEN 9 ELSE 10 END, level`)
      .run<LanguagePathRow>(),
    database.prepare(`SELECT c.id, c.owner_user_id AS ownerUserId,
      u.display_name AS ownerName, c.path_id AS pathId,
      p.title_en AS pathTitleEn, p.title_zh AS pathTitleZh,
      c.class_kind AS classKind, c.owner_role AS ownerRole, c.title, c.summary,
      c.target_language AS targetLanguage, c.level, c.schedule,
      c.status, c.visibility, c.price_cents AS priceCents, c.currency,
      c.capacity, c.created_at AS createdAt,
      mine.role AS membershipRole, mine.status AS membershipStatus,
      COALESCE(SUM(CASE WHEN members.role = 'student' AND members.status = 'active' THEN 1 ELSE 0 END), 0) AS enrollmentCount
      FROM smartlingo_language_classes c
      JOIN users u ON u.id = c.owner_user_id
      JOIN smartlingo_language_paths p ON p.id = c.path_id
      LEFT JOIN smartlingo_language_class_members mine ON mine.class_id = c.id AND mine.user_id = ?
      LEFT JOIN smartlingo_language_class_members members ON members.class_id = c.id
      WHERE c.owner_user_id = ?
         OR (c.visibility = 'public' AND c.status = 'open')
         OR mine.status IN ('active', 'invited', 'paused')
      GROUP BY c.id
      ORDER BY CASE
        WHEN c.owner_user_id = ? THEN 0
        WHEN mine.status IN ('active', 'invited', 'paused') THEN 1
        WHEN c.class_kind = 'official_language' THEN 2
        ELSE 3 END,
        CASE c.target_language
          WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3
          WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7
          WHEN 'it' THEN 8 WHEN 'pt' THEN 9 ELSE 10 END,
        c.updated_at DESC
      LIMIT 240`).bind(user.id, user.id, user.id).run<LanguageClassRow>(),
    database.prepare(`SELECT onboarding_status AS onboardingStatus,
      charges_enabled AS chargesEnabled, payouts_enabled AS payoutsEnabled,
      requirements_due AS requirementsDue
      FROM smartlingo_connected_accounts WHERE user_id = ? LIMIT 1`)
      .bind(user.id).first<ConnectedAccountRow>(),
  ]);

  const classes = (classResult.results || []).map(row => classView(row, user.id));
  const createdClasses = classes.filter(item => item.isOwner);
  const joinedClasses = classes.filter(item => item.isJoined);
  const availableClasses = classes.filter(item => !item.isOwner && !item.isJoined && item.visibility === "public" && item.status === "open");

  return Response.json({
    currentUser: { id: user.id, displayName: user.displayName },
    member: { canCreatePrivateClass: true, allowedOwnerRoles: ["teacher", "coordinator"] },
    paths: pathResult.results || [],
    classes,
    availableClasses,
    joinedClasses,
    createdClasses,
    connectedAccount: connectedAccount ? {
      onboardingStatus: connectedAccount.onboardingStatus,
      chargesEnabled: Boolean(connectedAccount.chargesEnabled),
      payoutsEnabled: Boolean(connectedAccount.payoutsEnabled),
      requirementsDue: parseRequirements(connectedAccount.requirementsDue || "[]"),
    } : {
      onboardingStatus: "not_started",
      chargesEnabled: false,
      payoutsEnabled: false,
      requirementsDue: [],
    },
    paymentPolicy: {
      firstPaymentDiscountPercent: 15,
      ownerSharePercent: 70,
      platformSharePercent: 30,
      splitBasis: "discounted_pre_tax",
      classPaymentsCreateIntroducerRewards: false,
    },
    paymentMode: "stripe_connect_not_enabled",
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid class request" }, { status: 400 });

  const ownerRole = input.ownerRole === "teacher"
    ? "teacher"
    : input.ownerRole === "coordinator"
      ? "coordinator"
      : null;
  const pathId = cleanText(input.pathId, 100);
  const title = cleanText(input.title, 100);
  const summary = cleanMultiline(input.summary, 800);
  const schedule = cleanText(input.schedule, 120) || "Self-paced";
  if (!ownerRole) return Response.json({ error: "Choose teacher or coordinator." }, { status: 400 });
  if (!pathId || !title) return Response.json({ error: "Language path and class name are required." }, { status: 400 });

  let capacity: number;
  let priceCents: number;
  try {
    capacity = normalizeCapacity(input.capacity ?? 30);
    priceCents = normalizePriceCents(input.priceCents ?? 0);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid class values" }, { status: 400 });
  }

  const database = getDatabase();
  const path = await database.prepare(`SELECT id, target_language AS targetLanguage, level,
    title_en AS titleEn, title_zh AS titleZh
    FROM smartlingo_language_paths WHERE id = ? AND status = 'published' LIMIT 1`)
    .bind(pathId).first<LanguagePathRow>();
  if (!path) return Response.json({ error: "Published language path not found." }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const classId = createId();
  await database.prepare(`INSERT OR IGNORE INTO smartlingo_connected_accounts
    (user_id, provider, onboarding_status, charges_enabled, payouts_enabled, requirements_due, updated_at)
    VALUES (?, 'stripe_connect', 'not_started', 0, 0, '[]', ?)`)
    .bind(user.id, now).run();
  await database.prepare(`INSERT INTO smartlingo_language_classes
    (id, owner_user_id, path_id, class_kind, owner_role, title, summary, target_language, level,
     schedule, status, visibility, price_cents, currency, capacity, created_at, updated_at)
    VALUES (?, ?, ?, 'member_language', ?, ?, ?, ?, ?, ?, 'open', 'private', ?, 'USD', ?, ?, ?)`)
    .bind(
      classId,
      user.id,
      path.id,
      ownerRole,
      title,
      summary,
      path.targetLanguage,
      path.level,
      schedule,
      priceCents,
      capacity,
      now,
      now,
    ).run();
  await database.prepare(`INSERT OR IGNORE INTO smartlingo_language_class_members
    (id, class_id, user_id, role, status, joined_at, updated_at)
    VALUES (?, ?, ?, 'owner', 'active', ?, ?)`)
    .bind(createId(), classId, user.id, now, now).run();

  return Response.json({
    id: classId,
    ownerRole,
    status: "open",
    visibility: "private",
    priceCents,
    firstPaymentQuote: quoteClassOrder({
      subtotalCents: priceCents,
      hasPriorPaidOrderForLearnerAndClass: false,
    }),
    charged: false,
  }, { status: 201 });
}
