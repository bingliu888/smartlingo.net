import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeCollegePricing } from "../lib/smartlingo-college-policy.ts";

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

test("creating a college atomically creates and places its introduction",async()=>{
  const data=await read("lib/smartlingo-colleges.ts"),route=await read("app/api/colleges/route.ts");
  assert.match(data,/INSERT INTO smartlingo_language_classes/);
  assert.match(data,/kind,position,created_at\) VALUES\(\?,\?,'introductory',0/);
  assert.match(data,/getDatabase\(\)\.batch/);
  assert.match(route,/getAdminUser/);
});

test("directory supports code entry, search, tags, access filters, and My colleges",async()=>{
  const page=await read("app/[lang]/colleges/page.tsx"),entry=await read("components/JoinCollegeByCode.tsx"),header=await read("components/SiteHeader.tsx"),home=await read("app/[lang]/page.tsx");
  assert.match(page,/type="search"/);assert.match(page,/view=mine/);assert.match(page,/query\.tag/);assert.match(page,/query\.access/);
  assert.ok(entry.indexOf("<input")<entry.indexOf("<button"));
  assert.match(entry,/zh\?"进入":"Enter"/);
  assert.match(header,/Choose College/);assert.match(header,/选择学院/);
  assert.ok(home.indexOf('id="home-colleges"')<home.indexOf('id="home-courses"'));
});

test("college course table supports introduction, add course, and localized access labels",async()=>{
  const page=await read("app/[lang]/college/[code]/page.tsx"),manager=await read("components/CollegeAdminForms.tsx"),card=await read("components/CollegeCard.tsx");
  assert.match(page,/COURSE TABLE/);assert.match(page,/introductoryCourseId/);assert.match(page,/CollegeManageForm/);
  assert.match(manager,/Add an existing course/);assert.match(manager,/创建学院与导论课程/);
  for(const label of ["Open college","Referred college","Private college","公开学院","推荐学院","专属学院"])assert.match(card+manager,new RegExp(label));
});

test("only the permanent administrator creates tags while college managers may update course tables",async()=>{
  const tags=await read("app/api/admin/college-tags/route.ts"),courses=await read("app/api/colleges/[code]/courses/route.ts");
  assert.match(tags,/getAdminUser/);assert.match(courses,/canManageCollege/);assert.match(courses,/smartlingo_college_courses/);
});

test("college code panel keeps the flexible edit box left of Enter at phone widths",async()=>{
  const css=await read("app/globals.css");
  assert.match(css,/\.college-code-entry\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/@media\(max-width:620px\)\{\.college-code-entry\{grid-template-columns:minmax\(0,1fr\) auto/);
});
