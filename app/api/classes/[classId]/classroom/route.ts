import { ensureCourseClassroom } from "@/lib/course-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";

type CourseRow = {
  id: string; ownerUserId: string; ownerEmail: string; ownerName: string;
  title: string; summary: string; targetLanguage: string; membershipStatus: string | null;
  subscriptionStatus: string | null; trialEndsAt: number | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { classId } = await params;
  const course = await getDatabase().prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,u.email AS ownerEmail,
    u.display_name AS ownerName,c.title,c.summary,c.target_language AS targetLanguage,m.status AS membershipStatus,
    s.status AS subscriptionStatus,s.trial_ends_at AS trialEndsAt
    FROM smartlingo_language_classes c JOIN users u ON u.id=c.owner_user_id
    LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id AND m.user_id=?
    LEFT JOIN smartlingo_course_subscriptions s ON s.class_id=c.id AND s.user_id=?
    WHERE c.id=? LIMIT 1`).bind(user.id, user.id, classId).first<CourseRow>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  const room = await ensureCourseClassroom(course);
  if (!room) return Response.json({ error: "Classroom unavailable" }, { status: 503 });
  const isManager = await canManageClass(room, user);
  const now = Math.floor(Date.now() / 1000);
  const subscribed = course.membershipStatus === "active" && (course.subscriptionStatus === "active"
    || (course.subscriptionStatus === "trialing" && Number(course.trialEndsAt || 0) > now));
  if (!isManager && !subscribed) {
    return Response.json({ error: "Course membership required" }, { status: 403 });
  }
  return Response.json({ room: { code: room.code, title: room.title, streamingMode: room.streamingMode, realtimeMode: room.realtimeMode, streamActive: Boolean(room.streamActive) }, isOwner: isManager });
}
