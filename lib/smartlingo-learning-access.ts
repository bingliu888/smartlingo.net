import type { SessionUser } from "./auth";

type StatementResult<T> = { results?: T[]; success?: boolean };
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<StatementResult<T>>;
};
export type LearningDatabase = { prepare(query: string): Statement };

export type OfficialClassAccess = {
  classId: string;
  classKind: "official_language" | "official_course";
  pathId: string;
  targetLanguage: string;
  level: string;
  packageTier: "basic" | "intermediate" | "advanced" | null;
  title: string;
  membershipRole: string;
};

const PUBLIC_BEGINNER_SPRINT_ID = /^course_(zh|en|es|ja|ko|fr|de|ru|it|pt|ar|hi)_basic$/;

export function isPublicBeginnerSprintClassId(classId: string) {
  return PUBLIC_BEGINNER_SPRINT_ID.test(classId);
}

export async function requirePublicBeginnerSprintCourse(database: LearningDatabase, classId: string) {
  if (!isPublicBeginnerSprintClassId(classId)) return null;
  return database.prepare(`SELECT c.id AS classId,c.class_kind AS classKind,c.path_id AS pathId,
    c.target_language AS targetLanguage,c.level,c.package_tier AS packageTier,c.title,
    'learner' AS membershipRole
    FROM smartlingo_language_classes c
    JOIN smartlingo_language_paths path
      ON path.id=c.path_id AND path.target_language=c.target_language
    WHERE c.id=? AND c.class_kind='official_course' AND c.level='beginner'
      AND c.status='open' AND c.visibility='public' AND path.status='published'
    LIMIT 1`).bind(classId).first<OfficialClassAccess>();
}

export async function requireOfficialClassMembership(
  database: LearningDatabase,
  user: SessionUser,
  classId: string,
) {
  const access = await database.prepare(`SELECT c.id AS classId,c.class_kind AS classKind,c.path_id AS pathId,
    c.target_language AS targetLanguage,c.level,c.package_tier AS packageTier,c.title,
    member.role AS membershipRole
    FROM smartlingo_language_classes c
    JOIN smartlingo_language_paths path
      ON path.id = c.path_id AND path.target_language = c.target_language
    JOIN smartlingo_language_class_members member
      ON member.class_id = c.id AND member.user_id = ? AND member.status = 'active'
    LEFT JOIN smartlingo_course_subscriptions subscription
      ON subscription.class_id=c.id AND subscription.user_id=member.user_id
    WHERE c.id = ? AND c.class_kind IN ('official_language','official_course')
      AND c.status = 'open' AND c.visibility = 'public'
      AND (c.class_kind='official_language' OR subscription.status='active'
        OR (subscription.status='trialing' AND subscription.trial_ends_at>unixepoch()))
      AND path.status = 'published'
    LIMIT 1`).bind(user.id, classId).first<OfficialClassAccess>();
  return access;
}

export function safeTimeZone(value: string | null) {
  const fallback = "UTC";
  if (!value || value.length > 80) return fallback;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallback;
  }
}

export function localDateKey(timestampSeconds: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampSeconds * 1000));
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
