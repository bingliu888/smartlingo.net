import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("daily practice opens durable vocab or immersive speaking training", async () => {
  const [learnPage, trainingMenu, sessionPage, placementPage, learningRoute, workspace] = await Promise.all([
    read("../app/[lang]/classes/[classId]/learn/page.tsx"),
    read("../components/CourseTrainingMenu.tsx"),
    read("../app/[lang]/classes/[classId]/learn/session/page.tsx"),
    read("../app/[lang]/classes/[classId]/placement/page.tsx"),
    read("../app/api/classes/[classId]/learning/route.ts"),
    read("../components/LearningWorkspace.tsx"),
  ]);

  assert.match(learnPage, /CourseTrainingMenu/);
  for (const training of ["Vocabulary", "Speaking", "Listening", "Writing", "Quiz"]) assert.match(trainingMenu, new RegExp(training));
  assert.match(trainingMenu, /training=vocabulary/);
  assert.match(trainingMenu, /training=dialogue/);
  assert.match(trainingMenu, /training=quiz/);
  assert.match(trainingMenu, /training=listening/);
  assert.match(trainingMenu, /口音校正/);
  assert.match(trainingMenu, /演讲训练/);
  assert.match(trainingMenu, /演讲稿修改/);
  assert.match(sessionPage, /query\.training === "writing" \? "writing"/);
  assert.match(sessionPage, /query\.training === "quiz" \? "exam"/);
  assert.match(placementPage, /redirect\(`\/\$\{lang\}\/classes\/\$\{encodeURIComponent\(classId\)\}\/learn`\)/);
  assert.match(learningRoute, /fixedCoursePlacement/);
  assert.match(learningRoute, /entryMode: "fixed_course"/);
  assert.match(workspace, /const selectedStep = initialSkill \?\?/);
  assert.match(workspace, /className="sl-primary-training-menu"/);
  assert.match(workspace, />Vocab</);
  assert.match(workspace, />Speaking</);
  assert.match(workspace, /sl-speaking-stage/);
  assert.match(workspace, /SMARTLINGO 人工智能导师/);
  assert.match(workspace, /导师已就绪/);
  assert.match(workspace, /startDictation\(skill, task\.speechLocale\)/);
  assert.match(workspace, /submitTask\(task, false\)/);
  assert.match(workspace, /跟我说/);
  assert.match(workspace, /回答我/);
  assert.match(workspace, /startDialogueTraining\(task, "follow"\)/);
  assert.match(workspace, /startDialogueTraining\(task, "answer"\)/);
  assert.match(workspace, /action: "submit_task", taskId: task\.taskId, skill: "dialogue", answer: transcript/);
});
