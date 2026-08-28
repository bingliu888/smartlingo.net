import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCollegePricing } from "../lib/smartlingo-college-policy.ts";
import { sortCollegesByCode } from "../lib/smartlingo-college-sort.ts";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("college pricing keeps Open, Referred, and Private policy behavior",()=>{
  assert.deepEqual(normalizeCollegePricing({accessType:"public",tuition:99,trialDays:30}),{accessType:"public",tuitionCents:0,trialDays:30});
  assert.deepEqual(normalizeCollegePricing({accessType:"trial",tuition:49.5,trialDays:14}),{accessType:"trial",tuitionCents:4950,trialDays:14});
  assert.deepEqual(normalizeCollegePricing({accessType:"private",tuition:199,trialDays:7}),{accessType:"private",tuitionCents:19900,trialDays:0});
  assert.throws(()=>normalizeCollegePricing({accessType:"trial",tuition:0,trialDays:7}),/INVALID_COLLEGE_PRICE/);
});

test("college migration creates isolated structure, four tags, four colleges, and automatic introductions",async()=>{
  const migration=await read("drizzle/0150_smartlingo_colleges.sql");
  for(const table of ["smartlingo_college_tags","smartlingo_colleges","smartlingo_college_tag_assignments","smartlingo_college_courses"])assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  for(const label of ["General","Finance","Lifestyle","Sports","通用","金融","生活方式","体育"])assert.match(migration,new RegExp(label));
  for(const code of ["820101","820102","820103","820104"])assert.match(migration,new RegExp(code));
  assert.match(migration,/introductory_course_id TEXT NOT NULL UNIQUE REFERENCES smartlingo_language_classes/);
});

test("college catalog uses the four requested specialties and adds the three administrator courses",async()=>{
  const migration=await read("drizzle/0151_college_catalog.sql");
  for(const label of ["Language College","Business College","Career College","Test Prep College","语言学院","商务学院","职业学院","备考学院"])assert.match(migration,new RegExp(label));
  for(const tag of ["General","Professional","Test Prep","通用","专业","备考"])assert.match(migration,new RegExp(`name_(?:en|zh)='${tag}'`));
  assert.match(migration,/active=0/);
  for(const course of ["course_en_basic","course_en_intermediate","course_en_advanced"])assert.match(migration,new RegExp(course));
  assert.deepEqual(sortCollegesByCode([{code:"820104"},{code:"820101"},{code:"820103"},{code:"820102"}]).map(item=>item.code),["820101","820102","820103","820104"]);
});

test("creating a college requires an active College Supervisor license",async()=>{
  const data=await read("lib/smartlingo-colleges.ts"),route=await read("app/api/colleges/route.ts");
  assert.match(data,/INSERT INTO smartlingo_language_classes/);
  assert.match(data,/kind,position,created_at\) VALUES\(\?,\?,'introductory',0/);
  assert.match(data,/getDatabase\(\)\.batch/);
  assert.match(route,/canCreateCollege/);
  assert.match(route,/College Supervisor license required/);
  assert.match(data,/smartlingo_college_supervisor_licenses/);
});

test("My colleges offers the three one-time supervisor packages and college creation journey",async()=>{
  const [page,header,card,create,checkout,complete,webhook,migration]=await Promise.all([
    read("app/[lang]/colleges/mine/page.tsx"),read("components/HeaderAccount.tsx"),
    read("components/CollegeCard.tsx"),
    read("app/[lang]/college/create/page.tsx"),read("app/api/billing/platform/checkout/route.ts"),
    read("app/api/billing/platform/complete/route.ts"),read("app/api/billing/card/webhook/route.ts"),
    read("drizzle/0159_college_coordinator_subscription.sql"),
  ]);
  for(const marker of ["College Supervisor","学院总监","Create college","创建学院"])assert.match(page,new RegExp(marker));
  assert.match(header,/colleges\/mine/);assert.match(create,/canCreateCollege/);
  assert.match(card,/lang:InterfaceLanguage/);
  assert.match(checkout,/college_supervisor/);assert.match(webhook,/college_supervisor/);assert.match(complete,/syncStripeCollegeSupervisorLicense/);
  assert.match(checkout,/mode: "payment"/);
  assert.match(migration,/stripe_subscription_id/);
});

test("directory supports code entry, search, tags, access filters, and My colleges",async()=>{
  const page=await read("app/[lang]/colleges/page.tsx"),entry=await read("components/JoinCollegeByCode.tsx"),home=await read("app/[lang]/page.tsx"),locale=await read("lib/interface-locale.ts");
  assert.match(page,/type="search"/);assert.match(page,/view=mine/);assert.match(page,/query\.tag/);assert.match(page,/query\.access/);
  assert.ok(entry.indexOf("<input")<entry.indexOf("<button"));
  assert.match(entry,/zh\?"进入":"Enter"/);
  assert.match(locale,/Choose College/);assert.match(locale,/选择学院/);
  assert.ok(home.indexOf('href={`/${locale}/programs`}')<home.indexOf('href={`/${locale}/colleges`}'));
  assert.doesNotMatch(home,/home-courses|home-colleges/);
});

test("college page uses language departments instead of supervisor-authored courses",async()=>{
  const page=await read("app/[lang]/college/[code]/page.tsx"),manager=await read("components/CollegeAdminForms.tsx"),card=await read("components/CollegeCard.tsx");
  assert.match(page,/LANGUAGE DEPARTMENTS/);assert.match(page,/CollegeDepartmentManager/);assert.match(page,/CollegeManageForm/);
  assert.doesNotMatch(manager,/Add an existing course|创建学院与导论课程/);
  assert.match(manager,/Create enrollment college/);
  assert.match(card,/Open college|Referred college|Private college/);
});

test("supervisor tiers, departments, free products, webinar audio, and 70/30 checkout stay aligned",async()=>{
  const [plans,migration,departments,manager,detail,checkout,subscription,room]=await Promise.all([
    read("lib/college-supervisor-plans.ts"),read("drizzle/0160_college_supervisors_departments.sql"),read("lib/college-departments.ts"),
    read("components/CollegeDepartmentManager.tsx"),read("app/[lang]/college/[code]/departments/[departmentId]/page.tsx"),
    read("app/api/billing/card/checkout/route.ts"),read("lib/stripe-course-subscription.ts"),read("app/api/classrooms/[code]/route.ts"),
  ]);
  for(const marker of ["99_900","299_900","499_900","maxDepartments: 3","maxDepartments: 9","maxDepartments: 15","Gold Supervisor","Platinum Supervisor","Diamond Supervisor"])assert.match(plans,new RegExp(marker));
  for(const table of ["smartlingo_college_supervisor_licenses","smartlingo_college_departments","smartlingo_college_department_courses","smartlingo_department_classrooms","smartlingo_department_enrollments","smartlingo_department_subscription_payments"])assert.match(migration,new RegExp(table));
  assert.match(departments,/class_kind='official_course'/);assert.match(departments,/package_tier IN \('basic','intermediate','advanced'\)/);
  assert.match(departments,/'private','audio','webinar'/);assert.match(manager,/sourceLanguage/);assert.match(manager,/targetLanguage/);
  for(const product of ["Today’s Sprint","Everyday Speaking","SmartCard","SmartCard Challenge"])assert.match(detail,new RegExp(product));
  assert.match(checkout,/payment_intent_data\[application_fee_amount\]/);assert.match(checkout,/payment_intent_data\[transfer_data\]\[destination\]/);
  assert.match(checkout,/Math\.floor\(selectedPackage\.priceCents\*7_000\/10_000\)/);
  assert.match(subscription,/smartlingo_department_enrollments/);assert.match(room,/departmentWebinarLocked/);
  assert.match(migration,/owner_share_cents=\(gross_cents\*7000\)\/10000/);
});

test("only the permanent administrator creates tags and manual college course tables are retired",async()=>{
  const tags=await read("app/api/admin/college-tags/route.ts"),courses=await read("app/api/colleges/[code]/courses/route.ts");
  assert.match(tags,/getAdminUser/);assert.match(courses,/status:410/);assert.doesNotMatch(courses,/INSERT INTO smartlingo_college_courses/);
});

test("college code panel keeps the flexible edit box left of Enter at phone widths",async()=>{
  const css=await read("app/globals.css");
  assert.match(css,/\.college-code-entry\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/@media\(max-width:620px\)\{\.college-code-entry\{grid-template-columns:minmax\(0,1fr\) auto/);
});
