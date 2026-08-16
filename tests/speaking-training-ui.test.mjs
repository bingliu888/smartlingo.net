import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("daily practice opens durable vocab or immersive speaking training", async () => {
  const [learnPage, sessionPage, workspace] = await Promise.all([
    read("../app/[lang]/classes/[classId]/learn/page.tsx"),
    read("../app/[lang]/classes/[classId]/learn/session/page.tsx"),
    read("../components/LearningWorkspace.tsx"),
  ]);

  assert.match(learnPage, />Vocab</);
  assert.match(learnPage, />Speaking</);
  assert.match(learnPage, /training=vocabulary/);
  assert.match(learnPage, /training=dialogue/);
  assert.match(sessionPage, /query\.training === "dialogue" \? "dialogue" : query\.training === "vocabulary" \? "vocabulary" : undefined/);
  assert.match(workspace, /const selectedStep = initialSkill \?\?/);
  assert.match(workspace, /className="sl-primary-training-menu"/);
  assert.match(workspace, />Vocab</);
  assert.match(workspace, />Speaking</);
  assert.match(workspace, /sl-speaking-stage/);
  assert.match(workspace, /SMARTLINGO 人工智能导师/);
  assert.match(workspace, /导师已就绪/);
  assert.match(workspace, /startDictation\(skill, task\.speechLocale\)/);
  assert.match(workspace, /submitTask\(task, false\)/);
});
