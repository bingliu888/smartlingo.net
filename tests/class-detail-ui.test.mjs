import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/class-detail-experience.tsx", import.meta.url), "utf8");
const standardCss = new URL("../app/classes/classes.css", import.meta.url);
const localizedCss = new URL("../app/[lang]/classes/classes.css", import.meta.url);
const classroomCss = new URL("../app/[lang]/classrooms/classrooms.css", import.meta.url);
const css = readFileSync(existsSync(standardCss) ? standardCss : existsSync(localizedCss) ? localizedCss : classroomCss, "utf8");

test("class detail uses the SmartClass entry experience", () => {
  for (const contract of ["class-entry-heading", "class-entry-stage", "class-entry-attendees", "Display name", "Create class image", "Online learners"]) assert.match(source, new RegExp(contract));
  assert.match(source, /fetch\(`\$\{mediaBase\}\/\$\{room\.code\}\/media`/);
  assert.match(source, /navigator\.share/);
  assert.match(source, /canvas\.toBlob/);
  assert.match(css, /\.class-entry-layout\{display:grid/);
  assert.match(css, /@media\(max-width:900px\).*class-entry-layout\{grid-template-columns:1fr\}/s);
});
