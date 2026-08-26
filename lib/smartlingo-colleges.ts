import { createId, getDatabase, type SessionUser } from "./auth";
import { isPermanentAdmin } from "./admin-access";
import { normalizeCollegePricing, type CollegeAccessType } from "./smartlingo-college-policy";
import { sortCollegesByCode } from "./smartlingo-college-sort";

export { sortCollegesByCode } from "./smartlingo-college-sort";

export type { CollegeAccessType } from "./smartlingo-college-policy";
export type CollegeTag = { id: string; slug: string; nameEn: string; nameZh: string; sortOrder: number; active: number };
export type CollegeRow = {
  id: string; code: string; ownerUserId: string; ownerName: string;
  titleEn: string; titleZh: string; descriptionEn: string; descriptionZh: string;
  accessType: CollegeAccessType; tuitionCents: number; currency: string; trialDays: number;
  introductoryCourseId: string; courseCount: number; tagsText: string; status: string;
};
export type CollegeCourse = {
  id: string; title: string; summary: string; targetLanguage: string; level: string;
  priceCents: number; currency: string; trialDays: number; visibility: string;
  packageTier: string | null; kind: "introductory" | "standard"; position: number;
};

const selection = `SELECT college.id,college.code,college.owner_user_id AS ownerUserId,
  owner.display_name AS ownerName,college.title_en AS titleEn,college.title_zh AS titleZh,
  college.description_en AS descriptionEn,college.description_zh AS descriptionZh,
  college.access_type AS accessType,college.tuition_cents AS tuitionCents,college.currency,
  college.trial_days AS trialDays,college.introductory_course_id AS introductoryCourseId,
  college.status,(SELECT COUNT(*) FROM smartlingo_college_courses cc WHERE cc.college_id=college.id) AS courseCount,
  COALESCE((SELECT group_concat(tag.id||'~'||tag.slug||'~'||tag.name_en||'~'||tag.name_zh,'|')
    FROM smartlingo_college_tag_assignments assignment
    JOIN smartlingo_college_tags tag ON tag.id=assignment.tag_id
    WHERE assignment.college_id=college.id AND tag.active=1),'') AS tagsText
  FROM smartlingo_colleges college JOIN users owner ON owner.id=college.owner_user_id`;

export function collegeTags(college: Pick<CollegeRow, "tagsText">): CollegeTag[] {
  return college.tagsText.split("|").filter(Boolean).map(value => {
    const [id, slug, nameEn, nameZh] = value.split("~");
    return { id, slug, nameEn, nameZh, sortOrder: 0, active: 1 };
  });
}

export async function activeCollegeTags(includeInactive = false) {
  const result = await getDatabase().prepare(`SELECT id,slug,name_en AS nameEn,name_zh AS nameZh,
    sort_order AS sortOrder,active FROM smartlingo_college_tags ${includeInactive ? "" : "WHERE active=1"}
    ORDER BY sort_order,name_en`).run<CollegeTag>();
  return result.results || [];
}

export async function collegeByCode(code: string) {
  return getDatabase().prepare(`${selection} WHERE college.code=? LIMIT 1`).bind(code).first<CollegeRow>();
}

export async function colleges(filters: { query?: string; tag?: string; access?: string; userId?: string; mine?: boolean } = {}) {
  const query = String(filters.query || "").trim().slice(0, 80);
  const tag = String(filters.tag || "").trim().slice(0, 40);
  const access = ["public", "trial", "private"].includes(String(filters.access)) ? String(filters.access) : "";
  const userId = String(filters.userId || "");
  const mine = Boolean(filters.mine && userId);
  const result = await getDatabase().prepare(`${selection} WHERE college.status='active'
    AND (?='' OR college.title_en LIKE '%'||?||'%' OR college.title_zh LIKE '%'||?||'%'
      OR college.description_en LIKE '%'||?||'%' OR college.description_zh LIKE '%'||?||'%' OR college.code=?)
    AND (?='' OR college.access_type=?)
    AND (?='' OR EXISTS(SELECT 1 FROM smartlingo_college_tag_assignments a
      JOIN smartlingo_college_tags t ON t.id=a.tag_id WHERE a.college_id=college.id AND t.slug=? AND t.active=1))
    AND (?=0 OR college.owner_user_id=? OR EXISTS(SELECT 1 FROM smartlingo_college_courses mine_course
      JOIN smartlingo_language_class_members mine_member ON mine_member.class_id=mine_course.course_id
      WHERE mine_course.college_id=college.id AND mine_member.user_id=? AND mine_member.status='active'))
    ORDER BY college.code ASC LIMIT 100`)
    .bind(query,query,query,query,query,query,access,access,tag,tag,mine ? 1 : 0,userId,userId)
    .run<CollegeRow>();
  return sortCollegesByCode(result.results || []);
}

export async function collegeCourses(collegeId: string) {
  const result = await getDatabase().prepare(`SELECT course.id,course.title,course.summary,
    course.target_language AS targetLanguage,course.level,course.price_cents AS priceCents,
    course.currency,course.trial_days AS trialDays,course.visibility,course.package_tier AS packageTier,
    placement.kind,placement.position
    FROM smartlingo_college_courses placement
    JOIN smartlingo_language_classes course ON course.id=placement.course_id
    WHERE placement.college_id=? AND course.status='open'
    ORDER BY placement.position,placement.created_at`).bind(collegeId).run<CollegeCourse>();
  return result.results || [];
}

export async function availableCollegeCourses(collegeId: string) {
  const result = await getDatabase().prepare(`SELECT id,title,target_language AS targetLanguage,level
    FROM smartlingo_language_classes WHERE status='open' AND class_kind IN ('official_course','subject')
    AND id NOT IN (SELECT course_id FROM smartlingo_college_courses WHERE college_id=?)
    ORDER BY target_language,CASE package_tier WHEN 'basic' THEN 0 WHEN 'intermediate' THEN 1 ELSE 2 END,title`)
    .bind(collegeId).run<{ id: string; title: string; targetLanguage: string; level: string }>();
  return result.results || [];
}

export function canManageCollege(college: Pick<CollegeRow, "ownerUserId">, user: SessionUser | null) {
  return Boolean(user && (college.ownerUserId === user.id || isPermanentAdmin(user)));
}

export async function canCreateCollege(user: SessionUser | null) {
  if (!user) return false;
  if (isPermanentAdmin(user)) return true;
  return Boolean(await getDatabase().prepare(`SELECT 1 FROM smartlingo_college_supervisor_licenses
    WHERE user_id=? AND status='active' LIMIT 1`).bind(user.id).first());
}

async function generateCollegeCode() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    if (!await getDatabase().prepare("SELECT 1 FROM smartlingo_colleges WHERE code=?").bind(code).first()) return code;
  }
  throw new Error("COLLEGE_CODE_UNAVAILABLE");
}

function text(value: unknown, maximum: number) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum); }

export async function createCollege(user: SessionUser, input: Record<string, unknown>) {
  const titleEn=text(input.titleEn,120),titleZh=text(input.titleZh,120);
  if(titleEn.length<3||titleZh.length<2)throw new Error("INVALID_COLLEGE");
  const descriptionEn=text(input.descriptionEn,1200),descriptionZh=text(input.descriptionZh,1200);
  const pricing=normalizeCollegePricing(input),tagSlug=text(input.tag||"general",40).toLowerCase();
  const tag=await getDatabase().prepare("SELECT id FROM smartlingo_college_tags WHERE slug=? AND active=1 LIMIT 1").bind(tagSlug).first<{id:string}>()
    ||await getDatabase().prepare("SELECT id FROM smartlingo_college_tags WHERE slug='general' AND active=1 LIMIT 1").first<{id:string}>();
  const path=await getDatabase().prepare("SELECT id,target_language AS targetLanguage,level FROM smartlingo_language_paths WHERE status='published' ORDER BY CASE target_language WHEN 'en' THEN 0 ELSE 1 END,level LIMIT 1").first<{id:string;targetLanguage:string;level:string}>();
  if(!tag||!path)throw new Error("COLLEGE_PREREQUISITE_UNAVAILABLE");
  const now=Math.floor(Date.now()/1000),collegeId=createId(),courseId=createId(),code=await generateCollegeCode();
  const visibility=pricing.accessType==="private"?"private":"public";
  await getDatabase().batch([
    getDatabase().prepare(`INSERT INTO smartlingo_language_classes
      (id,owner_user_id,path_id,class_kind,owner_role,title,summary,target_language,level,schedule,status,visibility,price_cents,currency,capacity,package_tier,billing_interval,trial_days,created_at,updated_at)
      VALUES(?,?,?,'subject','coordinator',?,?,?,?,?,'open',?,?,'USD',1000,'basic','month',?,?,?)`)
      .bind(courseId,user.id,path.id,`Introduction to ${titleEn} / ${titleZh}导论`,`${descriptionEn} / ${descriptionZh}`,path.targetLanguage,path.level,"Self-paced introduction",visibility,pricing.tuitionCents,pricing.trialDays,now,now),
    getDatabase().prepare("INSERT INTO smartlingo_language_class_members(id,class_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'owner','active',?,?)")
      .bind(createId(),courseId,user.id,now,now),
    getDatabase().prepare(`INSERT INTO smartlingo_colleges
      (id,code,owner_user_id,title_en,title_zh,description_en,description_zh,access_type,tuition_cents,currency,trial_days,introductory_course_id,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,'USD',?,?,'active',?,?)`)
      .bind(collegeId,code,user.id,titleEn,titleZh,descriptionEn,descriptionZh,pricing.accessType,pricing.tuitionCents,pricing.trialDays,courseId,now,now),
    getDatabase().prepare("INSERT INTO smartlingo_college_courses(college_id,course_id,kind,position,created_at) VALUES(?,?,'introductory',0,?)").bind(collegeId,courseId,now),
    getDatabase().prepare("INSERT INTO smartlingo_college_tag_assignments(college_id,tag_id,created_at) VALUES(?,?,?)").bind(collegeId,tag.id,now),
  ]);
  return { code, introductoryCourseId: courseId };
}

export async function updateCollege(college: CollegeRow, input: Record<string, unknown>) {
  const titleEn=text(input.titleEn,120),titleZh=text(input.titleZh,120);
  if(titleEn.length<3||titleZh.length<2)throw new Error("INVALID_COLLEGE");
  const descriptionEn=text(input.descriptionEn,1200),descriptionZh=text(input.descriptionZh,1200);
  const pricing=normalizeCollegePricing(input),tagSlug=text(input.tag||"general",40).toLowerCase();
  const tag=await getDatabase().prepare("SELECT id FROM smartlingo_college_tags WHERE slug=? AND active=1 LIMIT 1").bind(tagSlug).first<{id:string}>();
  if(!tag)throw new Error("COLLEGE_TAG_UNAVAILABLE");
  const now=Math.floor(Date.now()/1000),visibility=pricing.accessType==="private"?"private":"public";
  await getDatabase().batch([
    getDatabase().prepare(`UPDATE smartlingo_colleges SET title_en=?,title_zh=?,description_en=?,description_zh=?,
      access_type=?,tuition_cents=?,trial_days=?,updated_at=? WHERE id=?`).bind(titleEn,titleZh,descriptionEn,descriptionZh,pricing.accessType,pricing.tuitionCents,pricing.trialDays,now,college.id),
    getDatabase().prepare("UPDATE smartlingo_language_classes SET title=?,summary=?,visibility=?,price_cents=?,trial_days=?,updated_at=? WHERE id=?")
      .bind(`Introduction to ${titleEn} / ${titleZh}导论`,`${descriptionEn} / ${descriptionZh}`,visibility,pricing.tuitionCents,pricing.trialDays,now,college.introductoryCourseId),
    getDatabase().prepare("DELETE FROM smartlingo_college_tag_assignments WHERE college_id=?").bind(college.id),
    getDatabase().prepare("INSERT INTO smartlingo_college_tag_assignments(college_id,tag_id,created_at) VALUES(?,?,?)").bind(college.id,tag.id,now),
  ]);
}
