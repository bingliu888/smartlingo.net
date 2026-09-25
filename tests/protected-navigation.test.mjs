import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the primary navigation exposes Flash, Max and Guru", async () => {
  const header = await readFile(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");
  const community = await readFile(new URL("../app/[lang]/community/page.tsx", import.meta.url), "utf8");
  const locale = await readFile(new URL("../lib/interface-locale.ts", import.meta.url), "utf8");

  for (const label of ["Learn", "学习", "Practice", "练习", "Speak", "开口", "Community", "社区", "Me", "我的"]) assert.match(locale, new RegExp(label));
  for (const path of ["flash", "max", "assistant"]) assert.match(header, new RegExp(`\\/\\$\\{lang\\}\\/${path}`));
  assert.match(header, /links\.slice\(0, visibleLinkCount\)/);
  assert.match(header, /hiddenLinks\.map/);
  assert.doesNotMatch(header, /\/classes/);
  assert.match(community, /const signedIn = Boolean\(user\)/);
  assert.doesNotMatch(community, /redirect\(/);
  assert.match(community, /<NearbyLearning lang=\{lang\} signedIn=\{signedIn\}\/?>/);
  assert.match(community, /<CommunityMeetings lang=\{lang\} signedIn=\{signedIn\}\/?>/);
});
