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

test("the catalog publishes exactly nine fixed-term packages for three course levels", async () => {
  const [migration, packages, schema] = await Promise.all([
    read("../drizzle/0173_course_subscription_packages.sql"), read("../lib/smartlingo-course-packages.ts"), read("../db/schema.ts"),
  ]);
  for (const value of ["basic_3m", "basic_6m", "basic_12m", "intermediate_3m", "intermediate_6m", "intermediate_12m", "advanced_3m", "advanced_6m", "advanced_12m"]) assert.match(migration, new RegExp(value));
  for (const value of ["3000", "5000", "8000", "6000", "10000", "16000", "12000", "20000", "32000"]) assert.match(migration, new RegExp(value));
  assert.match(migration, /UNIQUE\(package_tier,duration_months\)/);
  assert.match(packages, /SMARTLINGO_COURSE_DURATIONS = \[3, 6, 12\]/);
  assert.match(packages, /口音校正/);
  assert.match(packages, /演讲训练/);
  assert.match(packages, /演讲稿修改/);
  assert.match(schema, /smartlingo_course_packages/);
  assert.match(schema, /smartlingo_course_package_purchases/);
});

test("fixed-term purchases create durable learning access scoped to one language course", async () => {
  const [enrollment, paymentActions, purchase, classroom, learning] = await Promise.all([
    read("../app/api/classes/[classId]/enroll/route.ts"),
    read("../components/CoursePaymentActions.tsx"),
    read("../lib/course-package-purchase.ts"),
    read("../app/api/classes/[classId]/classroom/route.ts"),
    read("../lib/smartlingo-learning-access.ts"),
  ]);
  assert.match(enrollment, /PACKAGE_PAYMENT_REQUIRED/);
  assert.match(paymentActions, /SMARTLINGO_COURSE_DURATIONS\.map/);
  assert.match(paymentActions, /targetLanguage/);
  assert.match(paymentActions, /months===3/);
  assert.match(purchase, /fixedCourseId\(input\.targetLanguage, input\.packageTier\)/);
  assert.match(purchase, /addCourseSubscriptionMonths\(accessStartsAt, input\.durationMonths\)/);
  assert.match(purchase, /smartlingo_course_package_purchases/);
  assert.match(purchase, /ensureCourseLearningEnrollment/);
  assert.match(classroom, /currentPeriodEndsAt\|\|0\)>now/);
  assert.match(learning, /current_period_ends_at>unixepoch\(\)/);
  assert.doesNotMatch(`${enrollment}\n${paymentActions}\n${purchase}`, /firstMonthFree|Start free first month|开始免费首月/);
  const studio = await read("../components/ClassStudio.tsx");
  assert.match(studio, /item\.classKind==="official_course"/);
  assert.match(studio, /Fixed-term access · no automatic renewal/);
  assert.match(studio, /固定期限学习权利 · 不自动续费/);
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
  assert.doesNotMatch(studio, /joinedTitle|class-catalog|class-section-heading/);
  assert.match(studio, /class-card-grid class-card-grid-list/);
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
