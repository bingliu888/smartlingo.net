import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { subscribedCourseHref } from "../lib/dashboard-learning-links.ts";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("dashboard has one Sprint language action and four independent learning sections",async()=>{
  const [sprint,hub,dashboard]=await Promise.all([read("components/DashboardDailySprint.tsx"),read("components/DashboardLearningHub.tsx"),read("app/[lang]/dashboard/page.tsx")]);
  assert.equal((sprint.match(/Add language/g)||[]).length,1);
  assert.match(sprint,/play\/sprint/);
  assert.match(sprint,/Learn .* through/);
  const order=["smartcards","challenge","everyday","courses"].map(value=>hub.indexOf(`\"${value}\"`));
  assert.ok(order.every(value=>value>=0)&&order.every((value,index)=>index===0||value>order[index-1]));
  assert.doesNotMatch(hub,/Ask AI|咨询AI/);
  assert.doesNotMatch(dashboard,/coming-card|每位会员都能开班/);
});

test("feature add actions lead to their own language or course selection pages",async()=>{
  const hub=await read("components/DashboardLearningHub.tsx"),setup=await read("components/DailySprintSetup.tsx");
  for(const marker of ["/smartcards","/play/challenge","/play/everyday","/programs"])assert.match(hub,new RegExp(marker.replaceAll("/","\\/")));
  assert.match(setup,/No course choice is required/);
  assert.match(setup,/course_\$\{target\.code\}_basic\/sprint/);
});

test("subscribed course links pass the selected language through the classes target contract",()=>{
  assert.equal(subscribedCourseHref("zh","en"),"/zh/classes?mine=1&target=en");
  assert.equal(subscribedCourseHref("es","it"),"/es/classes?mine=1&target=it");
  const url=new URL(subscribedCourseHref("ja","es"),"https://smartlingo.net");
  assert.equal(url.searchParams.get("target"),"es");
  assert.equal(url.searchParams.has("language"),false);
});
