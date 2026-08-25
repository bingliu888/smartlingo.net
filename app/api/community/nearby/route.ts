import { avatarsById } from "@/lib/member-avatars";
import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export const dynamic = "force-dynamic";

type NearbyProfile = {
  enabled: number;
  adultConfirmed: number;
  coarseRegion: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: "beginner" | "intermediate" | "advanced";
  studyMode: "vocabulary" | "challenge" | "speaking" | "mixed";
  availability: "weekdays" | "evenings" | "weekends" | "flexible";
  bio: string;
};

const levels = new Set(["beginner", "intermediate", "advanced"]);
const studyModes = new Set(["vocabulary", "challenge", "speaking", "mixed"]);
const availabilityOptions = new Set(["weekdays", "evenings", "weekends", "flexible"]);
const reportCategories = new Set(["spam", "harassment", "unsafe", "other"]);

function cleanText(value: unknown, maximum: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

async function ownProfile(userId: string) {
  return getDatabase().prepare(`SELECT enabled,adult_confirmed AS adultConfirmed,coarse_region AS coarseRegion,
    source_language AS sourceLanguage,target_language AS targetLanguage,level,study_mode AS studyMode,
    availability,bio FROM smartlingo_nearby_profiles WHERE user_id=? LIMIT 1`).bind(userId).first<NearbyProfile>();
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const profile = await ownProfile(user.id);
  if (!profile?.enabled) {
    return Response.json({ profile: profile ?? null, matches: [] }, { headers: { "cache-control": "private, no-store" } });
  }

  const result = await getDatabase().prepare(`SELECT member.id,member.display_name AS displayName,
    profile.coarse_region AS coarseRegion,profile.source_language AS sourceLanguage,
    profile.target_language AS targetLanguage,profile.level,profile.study_mode AS studyMode,
    profile.availability,profile.bio,profile.updated_at AS updatedAt
    FROM smartlingo_nearby_profiles profile JOIN users member ON member.id=profile.user_id
    WHERE profile.enabled=1 AND profile.adult_confirmed=1 AND profile.user_id<>?
      AND lower(profile.coarse_region)=lower(?)
      AND profile.source_language=? AND profile.target_language=?
      AND NOT EXISTS(SELECT 1 FROM smartlingo_nearby_blocks block
        WHERE (block.blocker_user_id=? AND block.blocked_user_id=profile.user_id)
           OR (block.blocker_user_id=profile.user_id AND block.blocked_user_id=?))
    ORDER BY CASE WHEN profile.level=? THEN 0 ELSE 1 END,
      CASE WHEN profile.study_mode=? THEN 0 ELSE 1 END,profile.updated_at DESC
    LIMIT 24`).bind(
      user.id,
      profile.coarseRegion,
      profile.sourceLanguage,
      profile.targetLanguage,
      user.id,
      user.id,
      profile.level,
      profile.studyMode,
    ).run<Record<string, string | number>>();
  const avatars = await avatarsById();
  const matches = (result.results ?? []).map(member => ({
    ...member,
    imageUrl: avatars.get(String(member.id)) || "",
  }));
  return Response.json({ profile, matches }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Invalid request" }, { status: 400 });
  const action = String(input.action || "save");
  const database = getDatabase();
  const now = Math.floor(Date.now() / 1000);

  if (action === "save") {
    const enabled = input.enabled === true;
    const adultConfirmed = input.adultConfirmed === true;
    const coarseRegion = cleanText(input.coarseRegion, 80);
    const sourceLanguage = String(input.sourceLanguage || "");
    const targetLanguage = String(input.targetLanguage || "");
    const level = String(input.level || "");
    const studyMode = String(input.studyMode || "");
    const availability = String(input.availability || "");
    const bio = cleanText(input.bio, 280);
    if (!isSmartLingoCommunityLanguage(sourceLanguage) || !isSmartLingoCommunityLanguage(targetLanguage) || sourceLanguage === targetLanguage) {
      return Response.json({ error: "Choose two different supported languages" }, { status: 400 });
    }
    if (!levels.has(level) || !studyModes.has(studyMode) || !availabilityOptions.has(availability)) {
      return Response.json({ error: "Choose a valid level, activity, and availability" }, { status: 400 });
    }
    if (enabled && (!adultConfirmed || coarseRegion.length < 2)) {
      return Response.json({ error: "Adult confirmation and a city or region are required" }, { status: 400 });
    }
    await database.prepare(`INSERT INTO smartlingo_nearby_profiles
      (user_id,enabled,adult_confirmed,coarse_region,source_language,target_language,level,study_mode,availability,bio,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,adult_confirmed=excluded.adult_confirmed,
        coarse_region=excluded.coarse_region,source_language=excluded.source_language,target_language=excluded.target_language,
        level=excluded.level,study_mode=excluded.study_mode,availability=excluded.availability,bio=excluded.bio,updated_at=excluded.updated_at`)
      .bind(user.id, enabled ? 1 : 0, adultConfirmed ? 1 : 0, coarseRegion, sourceLanguage, targetLanguage, level, studyMode, availability, bio, now, now).run();
    return Response.json({ ok: true });
  }

  const memberId = cleanText(input.memberId, 80);
  if (!memberId || memberId === user.id || !await database.prepare("SELECT 1 FROM users WHERE id=? LIMIT 1").bind(memberId).first()) {
    return Response.json({ error: "Choose a valid member" }, { status: 400 });
  }
  if (action === "block") {
    await database.prepare(`INSERT OR IGNORE INTO smartlingo_nearby_blocks
      (blocker_user_id,blocked_user_id,created_at) VALUES(?,?,?)`).bind(user.id, memberId, now).run();
    return Response.json({ ok: true });
  }
  if (action === "report") {
    const category = String(input.category || "");
    const detail = cleanText(input.detail, 500);
    if (!reportCategories.has(category)) return Response.json({ error: "Choose a report reason" }, { status: 400 });
    await database.batch([
      database.prepare(`INSERT INTO smartlingo_nearby_reports
        (id,reporter_user_id,reported_user_id,category,detail,status,created_at)
        VALUES(?,?,?,?,?,'open',?)`).bind(createId(), user.id, memberId, category, detail, now),
      database.prepare(`INSERT OR IGNORE INTO smartlingo_nearby_blocks
        (blocker_user_id,blocked_user_id,created_at) VALUES(?,?,?)`).bind(user.id, memberId, now),
    ]);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Invalid action" }, { status: 400 });
}
