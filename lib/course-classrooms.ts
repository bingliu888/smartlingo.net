import { createId, getDatabase, type SessionUser } from "@/lib/auth";
import { classByCode, generateClassCode, type ClassRoom } from "@/lib/live-classrooms";

export type CourseClassroomCourse = {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  title: string;
  summary: string;
  targetLanguage: string;
};

export async function courseClassroom(courseId: string) {
  return getDatabase().prepare(`SELECT r.code FROM smartlingo_course_classrooms cc
    JOIN live_class_rooms r ON r.id=cc.room_id
    WHERE cc.course_id=? AND r.status='active' LIMIT 1`).bind(courseId).first<{ code: string }>();
}

export async function ensureCourseClassroom(course: CourseClassroomCourse) {
  const existing = await courseClassroom(course.id);
  if (existing) return classByCode(existing.code);

  const db = getDatabase();
  const roomId = createId();
  const code = await generateClassCode();
  const now = Math.floor(Date.now() / 1000);
  try {
    await db.batch([
      db.prepare(`INSERT INTO live_class_rooms
        (id,code,host_user_id,host_email,host_name,title,description,subject,class_type,streaming_mode,realtime_mode,starts_at,duration_minutes,trial_minutes,tuition_cents,mute_all,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?, 'private','video','webinar',?,60,0,0,0,'active',?,?)`)
        .bind(roomId, code, course.ownerUserId, course.ownerEmail, course.ownerName, `${course.title} Classroom`, course.summary, `${course.targetLanguage.toUpperCase()} course`, now, now, now),
      db.prepare(`INSERT INTO smartlingo_course_classrooms(course_id,room_id,created_at) VALUES(?,?,?)`)
        .bind(course.id, roomId, now),
    ]);
    return classByCode(code);
  } catch (error) {
    const concurrent = await courseClassroom(course.id);
    if (concurrent) return classByCode(concurrent.code);
    throw error;
  }
}

export async function canUseCourseClassroom(courseId: string, user: SessionUser) {
  const row = await getDatabase().prepare(`SELECT c.owner_user_id AS ownerUserId, m.status AS membershipStatus
    FROM smartlingo_language_classes c
    LEFT JOIN smartlingo_language_class_members m ON m.class_id=c.id AND m.user_id=?
    WHERE c.id=? LIMIT 1`).bind(user.id, courseId).first<{ ownerUserId: string; membershipStatus: string | null }>();
  return Boolean(row && (row.ownerUserId === user.id || row.membershipStatus === "active"));
}
