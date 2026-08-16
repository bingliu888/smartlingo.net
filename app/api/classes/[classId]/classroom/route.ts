import { ensureCourseClassroom } from "@/lib/course-classrooms";
import { getDatabase, getSessionUser } from "@/lib/auth";

type CourseRow = {
  id: string; ownerUserId: string; ownerEmail: string; ownerName: string;
  title: string; summary: string; targetLanguage: string; membershipStatus: string | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { classId } = await params;
  const course = await getDatabase().prepare(`SELECT c.id,c.owner_user_id AS ownerUserId,u.email AS ownerEmail,
    u.display_name AS ownerName,c.title,c.summary,c.target_language AS targetLanguage,m.status AS membershipStatus
    FROM smartlingo_language_classes c JOIN users u ON u.id=c.owner_user_id
    LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id AND m.user_id=?
    WHERE c.id=? LIMIT 1`).bind(user.id, classId).first<CourseRow>();
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  const isOwner = course.ownerUserId === user.id;
  if (!isOwner && course.membershipStatus !== "active") {
    return Response.json({ error: "Course membership required" }, { status: 403 });
  }
  const room = await ensureCourseClassroom(course);
  if (!room) return Response.json({ error: "Classroom unavailable" }, { status: 503 });
  return Response.json({ room: { code: room.code, title: room.title, streamingMode: room.streamingMode, realtimeMode: room.realtimeMode, streamActive: Boolean(room.streamActive) }, isOwner });
}
