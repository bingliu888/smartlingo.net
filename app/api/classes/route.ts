import { getDatabase, getSessionUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

type LanguageClassRow = {
  id: string; ownerUserId: string; ownerName: string; pathId: string;
  pathTitleEn: string; pathTitleZh: string;
  classKind: "official_language" | "official_course" | "member_language" | "subject";
  ownerRole: "teacher" | "coordinator"; title: string; summary: string;
  targetLanguage: string; level: string; schedule: string; status: string; visibility: string;
  priceCents: number; currency: string; capacity: number;
  packageTier: "basic" | "intermediate" | "advanced" | null;
  billingInterval: "month"; trialDays: number; enrollmentCount: number;
  membershipRole: "owner" | "teacher" | "coordinator" | "student" | null;
  membershipStatus: "invited" | "active" | "paused" | "left" | "removed" | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "cancelled" | "expired" | null;
  trialEndsAt: number | null; createdAt: number;
};

function classView(row: LanguageClassRow, userId: string) {
  const isOwner = row.ownerUserId === userId || row.membershipRole === "owner";
  const isJoined = !isOwner && row.membershipStatus === "active"
    && (row.subscriptionStatus === "active" || (row.subscriptionStatus === "trialing" && Number(row.trialEndsAt || 0) > Math.floor(Date.now() / 1000)));
  return {
    ...row,
    enrollmentCount: Number(row.enrollmentCount || 0),
    isOwner,
    isJoined,
    canJoin: !isOwner && !isJoined && row.classKind === "official_course"
      && row.visibility === "public" && row.status === "open"
      && Number(row.enrollmentCount || 0) < row.capacity,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const database = getDatabase();
  const [pathResult, classResult] = await Promise.all([
    database.prepare(`SELECT id,slug,target_language AS targetLanguage,level,title_en AS titleEn,title_zh AS titleZh,version
      FROM smartlingo_language_paths WHERE status='published' ORDER BY target_language,level`).run(),
    database.prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,u.display_name AS ownerName,c.path_id AS pathId,
      p.title_en AS pathTitleEn,p.title_zh AS pathTitleZh,c.class_kind AS classKind,c.owner_role AS ownerRole,
      c.title,c.summary,c.target_language AS targetLanguage,c.level,c.schedule,c.status,c.visibility,
      c.price_cents AS priceCents,c.currency,c.capacity,c.package_tier AS packageTier,
      c.billing_interval AS billingInterval,c.trial_days AS trialDays,c.created_at AS createdAt,
      mine.role AS membershipRole,mine.status AS membershipStatus,
      subscription.status AS subscriptionStatus,subscription.trial_ends_at AS trialEndsAt,
      COALESCE(SUM(CASE WHEN members.role='student' AND members.status='active' THEN 1 ELSE 0 END),0) AS enrollmentCount
      FROM smartlingo_language_classes c
      JOIN users u ON u.id=c.owner_user_id JOIN smartlingo_language_paths p ON p.id=c.path_id
      LEFT JOIN smartlingo_language_class_members mine ON mine.class_id=c.id AND mine.user_id=?
      LEFT JOIN smartlingo_course_subscriptions subscription ON subscription.class_id=c.id AND subscription.user_id=?
      LEFT JOIN smartlingo_language_class_members members ON members.class_id=c.id
      WHERE c.class_kind='official_course' AND c.status='open' AND c.visibility='public' AND p.status='published'
      GROUP BY c.id
      ORDER BY CASE c.target_language WHEN 'zh' THEN 0 WHEN 'en' THEN 1 WHEN 'es' THEN 2 WHEN 'ja' THEN 3 WHEN 'ko' THEN 4 WHEN 'fr' THEN 5 WHEN 'de' THEN 6 WHEN 'ru' THEN 7 WHEN 'it' THEN 8 WHEN 'pt' THEN 9 WHEN 'ar' THEN 10 WHEN 'hi' THEN 11 ELSE 12 END,
      CASE c.package_tier WHEN 'basic' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END`).bind(user.id, user.id).run<LanguageClassRow>(),
  ]);
  const classes = (classResult.results || []).map(row => classView(row, user.id));
  return Response.json({
    currentUser: { id: user.id, displayName: user.displayName },
    member: { canCreatePrivateClass: false, allowedOwnerRoles: [] },
    paths: pathResult.results || [], classes,
    availableClasses: classes.filter(item => !item.isOwner && !item.isJoined),
    joinedClasses: classes.filter(item => item.isJoined), createdClasses: [],
    paymentPolicy: { trialDays: 30, billingInterval: "month", fixedPlatformPricing: true },
    paymentMode: "monthly_subscription",
  });
}

export async function POST(request: Request) {
  if (!await getSessionUser(request)) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({
    error: "MVP courses are created and priced only by SmartLingo administrators.",
    code: "MEMBER_COURSE_CREATION_DISABLED",
  }, { status: 403 });
}
