import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("course access labels use Open and 专属 product terminology", async () => {
  const copy = (await Promise.all([
    "app/[lang]/about/page.tsx",
    "app/[lang]/programs/page.tsx",
    "app/[lang]/terms/page.tsx",
    "components/CryptoCheckout.tsx",
    "components/CollegeAdminForms.tsx",
    "components/CollegeCard.tsx",
    "components/TalentDirectory.tsx",
    "components/class-detail-experience.tsx",
    "lib/editorial-content.ts",
    "lib/smartlingo-roadmap.ts",
  ].map(read))).join("\n");
  for (const label of ["Open course", "公开课程", "Private course", "专属课堂"]) {
    assert.match(copy, new RegExp(label));
  }
  assert.match(copy, /Referred course/);
  assert.match(copy, /推荐课程/);
  assert.match(copy, /Open webinars and HLS broadcasting/);
  assert.match(copy, /内置专属小组音视频与沟通中心/);
  for (const label of ["Open college", "公开学院", "Private college", "专属学院"]) {
    assert.match(copy, new RegExp(label));
  }
  assert.doesNotMatch(copy, /Public course|私有课程|私密课程|私课|私密小组/);
});
