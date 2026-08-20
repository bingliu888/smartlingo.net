import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("the subscribed course dashboard opens each training skill without another language choice", async () => {
  const [studio, learnPage, trainingMenu, sessionPage, placementPage, learningRoute, workspace] = await Promise.all([
    read("../components/ClassStudio.tsx"),
    read("../app/[lang]/classes/[classId]/learn/page.tsx"),
    read("../components/CourseTrainingMenu.tsx"),
    read("../app/[lang]/classes/[classId]/learn/session/page.tsx"),
    read("../app/[lang]/classes/[classId]/placement/page.tsx"),
    read("../app/api/classes/[classId]/learning/route.ts"),
    read("../components/LearningWorkspace.tsx"),
  ]);

  assert.match(studio, /class-skill-launcher/);
  assert.match(studio, /learningLinks\(item\)/);
  assert.match(studio, /\/vocabulary/);
  assert.match(studio, /training=dialogue/);
  assert.match(studio, /training=listening/);
  assert.match(studio, /training=writing/);
  assert.match(studio, /training=quiz/);
  assert.match(studio, /无需再次选择语言或参加分级测试/);
  assert.doesNotMatch(studio, /开始五项技能学习/);
  assert.match(learnPage, /CourseTrainingMenu/);
  for (const training of ["Vocabulary", "Speaking", "Listening", "Writing", "Quiz"]) assert.match(trainingMenu, new RegExp(training));
  assert.match(trainingMenu, /\/vocabulary/);
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

test("the person-avatar pronunciation coach leads five scored follow-me turns", async () => {
  const workspace = await readFile(new URL("../components/LearningWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /sl-person-avatar/);
  assert.match(workspace, /🧑‍🏫/);
  assert.match(workspace, /Follow me 5 times/);
  assert.match(workspace, /round >= 5/);
  assert.match(workspace, /runPronunciationCoachTurn\(item, round \+ 1\)/);
  assert.match(workspace, /pronunciationScores\.reduce/);
  assert.match(workspace, /speechSynthesis\.speak\(utterance\)/);
  assert.match(workspace, /action: "pronunciation_review"/);
});
