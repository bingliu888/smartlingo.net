import { getDatabase, getSessionUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-access";
import { canManageClass } from "@/lib/class-managers";
import { cleanText } from "@/lib/smartlingo-classes";

type Course = { id: string; ownerUserId: string; roomId: string | null };
export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request); if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const classId = cleanText((await params).classId, 100); const database = getDatabase();
  const course = await database.prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,classroom.room_id AS roomId FROM smartlingo_language_classes c LEFT JOIN smartlingo_course_classrooms classroom ON classroom.course_id=c.id WHERE c.id=? AND c.class_kind='official_course' LIMIT 1`).bind(classId).first<Course>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  const canManage = course.roomId ? await canManageClass({ id: course.roomId, hostUserId: course.ownerUserId }, user) : course.ownerUserId === user.id || await isAdminUser(user);
  if (!canManage) return Response.json({ error: "Course administrator access required" }, { status: 403 });
  const now = Math.floor(Date.now() / 1_000);
  const result = await database.prepare(`SELECT member.user_id AS userId,u.email,u.display_name AS displayName,member.joined_at AS joinedAt,CASE WHEN subscription.cadence='max' AND subscription.status='active' AND subscription.current_period_ends_at>? THEN 1 ELSE 0 END AS maxActive,subscription.current_period_ends_at AS currentPeriodEndsAt FROM smartlingo_language_class_members member JOIN users u ON u.id=member.user_id LEFT JOIN subscriptions subscription ON subscription.user_id=member.user_id WHERE member.class_id=? AND member.role='student' AND member.status='active' ORDER BY member.joined_at DESC,u.display_name COLLATE NOCASE`).bind(now, course.id).all<{ userId: string; email: string; displayName: string; joinedAt: number; maxActive: number; currentPeriodEndsAt: number | null }>();
  return Response.json({ students: (result.results || []).map(row => ({ ...row, maxActive: Boolean(row.maxActive) })) });
}
export async function POST() { return Response.json({ error: "Course-level subscriptions have been retired. Learners use Free or Max." }, { status: 410 }); }
export async function PATCH() { return Response.json({ error: "Course-level subscriptions have been retired. Learners use Free or Max." }, { status: 410 }); }
