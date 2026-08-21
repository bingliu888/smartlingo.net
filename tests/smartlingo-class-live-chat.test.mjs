import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("each course exposes a Webinar teaching room and pre-created group-audio practice room", () => {
  const route = read("app/api/classes/[classId]/classroom/route.ts");
  const panel = read("components/CourseClassroomTile.tsx");
  const helper = read("lib/course-classrooms.ts");
  const migration = read("drizzle/0118_course_classrooms.sql");
  const practiceMigration = read("drizzle/0122_course_practice_rooms.sql");
  const classStudio = read("components/ClassStudio.tsx");
  const learningPage = read("app/[lang]/classes/[classId]/learn/page.tsx");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS smartlingo_course_classrooms/);
  assert.match(helper, /'private','video','webinar'/);
  assert.match(practiceMigration, /CREATE TABLE IF NOT EXISTS smartlingo_course_practice_rooms/);
  assert.match(practiceMigration, /'private','audio','group_call'/);
  assert.match(practiceMigration, /FROM languages CROSS JOIN tiers/);
  assert.match(practiceMigration, /INSERT OR IGNORE INTO smartlingo_course_practice_rooms/);
  assert.match(helper, /ensureCoursePracticeRoom/);
  assert.match(route, /subscriptionStatus === "active"/);
  assert.match(route, /trialEndsAt/);
  assert.match(panel, /CourseClassroomTile/);
  assert.match(panel, /Teaching room/);
  assert.match(panel, /Practice room/);
  assert.match(panel, /Free for enrolled students/);
  assert.match(classStudio, /CourseClassroomTile/);
  assert.match(learningPage, /CourseClassroomTile/);
  assert.equal(existsSync(new URL("../components/ClassLiveChatPanel.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/classes/[classId]/live-chat/route.ts", import.meta.url)), false);
});

test("course audio remains beside text chat and standard calls auto-end after one solo or silent minute", () => {
  const calls = read("app/api/messages/calls/route.ts");
  const room = read("components/LiveChatRoom.tsx");
  const dock = read("components/ClassAudioCallDock.tsx");
  const migration = read("drizzle/0035_class_live_audio.sql");
  assert.match(calls, /reconcileCall/);
  assert.match(calls, /60 - \(now - soloSinceAt\)/);
  assert.match(calls, /participantCount === 0/);
  assert.match(calls, /status = 'ended', ended_at = \?/);
  assert.match(calls, /action === "heartbeat"/);
  assert.match(migration, /solo_since_at/);
  assert.match(migration, /last_seen_at/);
  assert.match(room, /Join audio call/);
  assert.match(room, /usePersistentCall/);
  assert.match(dock, /text chat stays available/);
});

test("course membership controls the embedded classroom", () => {
  const classRoute = read("app/api/classes/[classId]/classroom/route.ts");
  const roomAccess = read("lib/live-classrooms.ts");
  assert.match(classRoute, /Course membership required/);
  assert.match(roomAccess, /smartlingo_course_classrooms/);
  assert.match(roomAccess, /smartlingo_course_practice_rooms/);
  assert.match(roomAccess, /m\.status='active'/);
});
