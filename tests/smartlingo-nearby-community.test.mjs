import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Nearby stores only opt-in coarse-region discovery with adult and safety controls", async () => {
  const [migration, schema, route, client] = await Promise.all([
    read("../drizzle/0170_nearby_learning_partners.sql"),
    read("../db/schema.ts"),
    read("../app/api/community/nearby/route.ts"),
    read("../components/NearbyLearning.tsx"),
  ]);
  for (const table of ["smartlingo_nearby_profiles", "smartlingo_nearby_blocks", "smartlingo_nearby_reports"]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
    assert.match(schema, new RegExp(table));
  }
  assert.match(migration, /adult_confirmed/);
  assert.match(migration, /coarse_region/);
  assert.doesNotMatch(`${migration}\n${schema}\n${route}`, /latitude|longitude|gps|exact_address/i);
  assert.match(route, /profile\.enabled=1 AND profile\.adult_confirmed=1/);
  assert.match(route, /smartlingo_nearby_blocks/);
  assert.match(route, /smartlingo_nearby_reports/);
  assert.match(client, /I am 18 or older/);
  assert.match(client, /Block/);
  assert.match(client, /Report/);
});

test("Community always offers clearly disclosed AI classmates and keeps real matching optional", async () => {
  const [page, client, partners, assistant, assistantRoute] = await Promise.all([
    read("../app/[lang]/community/page.tsx"),
    read("../components/NearbyLearning.tsx"),
    read("../lib/smartlingo-ai-study-partners.ts"),
    read("../components/AssistantClient.tsx"),
    read("../app/api/assistant/route.ts"),
  ]);
  assert.match(page, /<NearbyLearning lang=\{lang\} signedIn=\{signedIn\}\/?>/);
  assert.doesNotMatch(page, /redirect\(/);
  for (const name of ["Mika", "Leo", "Aya"]) assert.match(partners, new RegExp(name));
  assert.match(client, /AI STUDY PARTNER/);
  assert.match(client, /partner=\$\{partner\.id\}/);
  assert.match(client, /No account is needed to start with an AI classmate/);
  assert.match(client, /if \(!signedIn\) return/);
  assert.match(client, /Sign in for real learners/);
  assert.match(assistant, /not a real person/);
  assert.match(assistant, /SmartLingo AI 学习伙伴，不是真人/);
  assert.match(assistantRoute, /Never imply that \$\{partner\.name\} is a real person/);
  assert.match(assistantRoute, /Take one short turn at a time/);
});

test("the dashboard places learning, practice, speaking, community, and two-level schools coherently", async () => {
  const [header, dashboard, hub, communityHub, colleges] = await Promise.all([
    read("../components/SiteHeader.tsx"),
    read("../app/[lang]/dashboard/page.tsx"),
    read("../components/DashboardLearningHub.tsx"),
    read("../components/DashboardCommunityHub.tsx"),
    read("../app/[lang]/colleges/mine/page.tsx"),
  ]);
  for (const key of ["learn", "practice", "speak", "community"]) assert.match(header, new RegExp(`data-nav=\"${key}\"`));
  assert.match(dashboard, /DashboardCommunityHub/);
  for (const domain of ["Learn", "Practice", "Speak"]) assert.match(hub, new RegExp(domain));
  assert.match(communityHub, /Nearby learning/);
  assert.match(communityHub, /My colleges/);
  assert.match(colleges, /TWO-LEVEL LEARNING SCHOOL/);
  assert.match(colleges, /3, 9, or 15 language departments/);
  assert.match(colleges, /70% to the college\/department and 30% to the platform/);
});
