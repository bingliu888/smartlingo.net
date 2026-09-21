import { ensureCourseClassroom, ensureCoursePracticeRoom } from "@/lib/course-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";
import { canManageClass } from "@/lib/class-managers";
import { hasCourseTierAccess } from "@/lib/platform-entitlements";

type CourseRow = {
  id: string; ownerUserId: string; ownerEmail: string; ownerName: string;
  title: string; summary: string; targetLanguage: string; packageTier: "basic" | "intermediate" | "advanced" | null; membershipStatus: string | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { classId } = await params;
  const course = await getDatabase().prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,u.email AS ownerEmail,
    u.display_name AS ownerName,c.title,c.summary,c.target_language AS targetLanguage,c.package_tier AS packageTier,m.status AS membershipStatus
    FROM smartlingo_language_classes c JOIN users u ON u.id=c.owner_user_id
    LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id AND m.user_id=?
    WHERE c.id=? LIMIT 1`).bind(user.id, classId).first<CourseRow>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  const [room, practiceRoom] = await Promise.all([ensureCourseClassroom(course), ensureCoursePracticeRoom(course)]);
  if (!room || !practiceRoom) return Response.json({ error: "Course room unavailable" }, { status: 503 });
  const isManager = await canManageClass(room, user);
  const subscribed = course.membershipStatus === "active" && (await hasCourseTierAccess(user, course.packageTier)).allowed;
  if (!isManager && !subscribed) {
    return Response.json({ error: "Course membership required" }, { status: 403 });
  }
  return Response.json({
    room: { code: room.code, title: room.title, streamingMode: room.streamingMode, realtimeMode: room.realtimeMode, streamActive: Boolean(room.streamActive) },
    practiceRoom: { code: practiceRoom.code, title: practiceRoom.title, streamingMode: practiceRoom.streamingMode, realtimeMode: practiceRoom.realtimeMode, streamActive: Boolean(practiceRoom.streamActive) },
    isOwner: isManager,
  });
}
