UPDATE smartlingo_language_classes
SET title = replace(replace(title, 'Basic', 'Beginner'), '基础课程', '初期课程'),
    summary = replace(replace(summary, 'Basic', 'Beginner'), '基础课程', '初期课程'),
    updated_at = unixepoch()
WHERE class_kind = 'official_course';
--> statement-breakpoint

UPDATE live_class_rooms
SET title = replace(replace(title, 'Basic', 'Beginner'), '基础课程', '初期课程'),
    updated_at = unixepoch()
WHERE id IN (
  SELECT cc.room_id
  FROM smartlingo_course_classrooms cc
  JOIN smartlingo_language_classes course ON course.id = cc.course_id
  WHERE course.class_kind = 'official_course'
);
--> statement-breakpoint

PRAGMA optimize;
