import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("ordinary members cannot create courses or set fees", async () => {
  const [route, studio] = await Promise.all([read("../app/api/classes/route.ts"), read("../components/ClassStudio.tsx")]);
  assert.match(route, /MEMBER_COURSE_CREATION_DISABLED/);
  assert.match(route, /status: 403/);
  assert.match(route, /canCreatePrivateClass: false/);
  assert.doesNotMatch(studio, /createClass|创建专属课堂|priceCents: Math\.round/);
});

test("the MVP seeds three fixed monthly courses for all twelve languages", async () => {
  const [migration, packages, schema] = await Promise.all([
    read("../drizzle/0119_fixed_mvp_courses.sql"), read("../lib/smartlingo-course-packages.ts"), read("../db/schema.ts"),
  ]);
  for (const value of ["basic", "intermediate", "advanced", "2000", "10000", "30000"]) assert.match(migration, new RegExp(value));
  assert.match(migration, /CROSS JOIN tiers/);
  assert.match(migration, /trial_days,created_at/);
  assert.match(packages, /口音校正/);
  assert.match(packages, /演讲训练/);
  assert.match(packages, /演讲稿修改/);
  assert.match(schema, /smartlingo_course_subscriptions/);
});

test("free first month is durable and course access checks subscription state", async () => {
  const [enrollment, paymentActions, reconciliation, classroom, learning] = await Promise.all([
    read("../app/api/classes/[classId]/enroll/route.ts"),
    read("../components/CoursePaymentActions.tsx"),
    read("../drizzle/0130_reconcile_browser_test_learner.sql"),
    read("../app/api/classes/[classId]/classroom/route.ts"),
    read("../lib/smartlingo-learning-access.ts"),
  ]);
  assert.match(enrollment, /course\.trialDays \* 86_400/);
  assert.match(enrollment, /smartlingo_course_subscriptions/);
  assert.match(enrollment, /firstMonthFree: true/);
  assert.match(enrollment, /smartlingo_course_offerings_v3/);
  assert.match(enrollment, /smartlingo_course_enrollments_v3/);
  assert.match(enrollment, /smartlingo_course_session_state/);
  assert.match(enrollment, /ensureLearningEnrollment\(database, course, user\.id, now\)/);
  assert.match(enrollment, /ON CONFLICT\(user_id,offering_id\) DO UPDATE/);
  assert.match(enrollment, /ON CONFLICT\(enrollment_id\) DO NOTHING/);
  assert.match(paymentActions, /api\/classes\/\$\{encodeURIComponent\(classId\)\}\/enroll/);
  assert.match(paymentActions, /开始免费首月/);
  assert.match(paymentActions, /Start free first month/);
  assert.match(paymentActions, /response\.ok && data\.enrolled/);
  assert.match(paymentActions, /window\.location\.assign\(`\/\$\{lang\}\/classes\/\$\{encodeURIComponent\(classId\)\}`\)/);
  assert.match(reconciliation, /smartlingo_course_subscriptions/);
  assert.match(reconciliation, /smartlingo_course_enrollments_v3/);
  assert.match(reconciliation, /smartlingo_course_session_state/);
  assert.match(reconciliation, /bingliu\+smartlingo-test1@cybeye\.com/);
  assert.match(reconciliation, /subscription\.class_id='course_en_basic'/);
  assert.match(reconciliation, /subscription\.status='trialing' AND subscription\.trial_ends_at>unixepoch\(\)/);
  assert.doesNotMatch(reconciliation, /WHEN 'intermediate'|ELSE 365/);
  assert.match(classroom, /subscriptionStatus === "trialing"/);
  assert.match(learning, /subscription\.trial_ends_at>unixepoch\(\)/);
});

test("admins and course co-hosts can edit while fixed price remains immutable", async () => {
  const detail = await read("../app/api/classes/[classId]/route.ts");
  assert.match(detail, /isAdminUser\(user\)/);
  assert.match(detail, /live_class_cohosts/);
  assert.match(detail, /update_official_course/);
  assert.doesNotMatch(detail.match(/if \(input\.action === "update_official_course"[\s\S]*?return Response\.json\(\{ ok: true/)?.[0] || "", /price_cents/);
});

test("Course Studio lists only subscribed courses and routes discovery to Choose courses", async () => {
  const studio = await read("../components/ClassStudio.tsx");
  assert.match(studio, /context\.joinedClasses/);
  assert.doesNotMatch(studio, /context\.availableClasses/);
  assert.match(studio, /选择课程/);
  assert.match(studio, /\$\{lang\}\/programs/);
  assert.match(studio, /CourseClassroomTile/);
  assert.doesNotMatch(studio, /70 \/ 30|Stripe Connect|我创建的课程/);
});

test("each subscribed course exposes five direct training entries tied to its course id", async () => {
  const [studio, session, learning] = await Promise.all([
    read("../components/ClassStudio.tsx"),
    read("../app/[lang]/classes/[classId]/learn/session/page.tsx"),
    read("../app/api/classes/[classId]/learning/route.ts"),
  ]);
  assert.match(studio, /const encodedClassId = encodeURIComponent\(item\.id\)/);
  for (const route of ["training=dialogue", "training=listening", "training=writing", "training=quiz"]) assert.match(studio, new RegExp(route));
  assert.match(studio, /classes\/\$\{encodedClassId\}\/vocabulary/);
  assert.match(session, /initialSkill=\{query\.training === "quiz" \? "exam"/);
  assert.match(learning, /access\.classKind === "official_course"[\s\S]*fixedCoursePlacement\(access\)/);
  assert.match(learning, /entryMode: "fixed_course"/);
});
