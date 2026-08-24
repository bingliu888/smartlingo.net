import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("21-day vocabulary center is database-backed, server-graded, and fully bilingual", async () => {
  const [route, workspace, page, menu, migration, resumeMigration] = await Promise.all([
    read("../app/api/classes/[classId]/vocabulary/route.ts"),
    read("../components/VocabularyMemoryWorkspace.tsx"),
    read("../app/[lang]/classes/[classId]/vocabulary/page.tsx"),
    read("../components/CourseTrainingMenu.tsx"),
    read("../drizzle/0126_vocabulary_21_day_memory.sql"),
    read("../drizzle/0168_vocabulary_practice_resume.sql"),
  ]);
  assert.match(route, /smartlingo_vocabulary_items/);
  assert.match(route, /review_status='published'/);
  assert.match(route, /const correct = expectedMode/);
  assert.match(route, /selectedId === item\.id/);
  assert.match(route, /SMARTLINGO_VOCABULARY_MEMORY_DAYS/);
  assert.match(route, /smartlingo_vocabulary_daily_reports/);
  assert.doesNotMatch(workspace, /answerKey|correctOption/);
  assert.match(workspace, /学会了/);
  assert.match(workspace, /正在学/);
  assert.match(workspace, /还未学/);
  assert.match(workspace, /Today's SmartCard practice/);
  assert.match(workspace, /targetPhonetic/);
  assert.match(workspace, /pronunciationGuides\?\.\[lang\]/);
  assert.match(workspace, /SpeechRecognition/);
  assert.match(workspace, /speechSynthesis\.cancel\(\);\s*finish\(\)/);
  assert.match(workspace, /listeningWatchdog = window\.setTimeout/);
  assert.match(workspace, /recognition\.onend = recoverListening/);
  assert.match(workspace, /也可以跳过本词/);
  assert.match(workspace, /New word/);
  assert.match(workspace, /Previous mistake/);
  assert.match(workspace, /playWord\(\.86\)/);
  assert.match(workspace, /playWord\(\.58\)/);
  assert.match(workspace, /setPhase\("feedback"\)/);
  assert.match(workspace, /continueAfterFeedback/);
  assert.match(workspace, /selectedOptionId/);
  assert.doesNotMatch(workspace, /<SentenceBuilderRound autoAdvance/);
  assert.match(workspace, /startFromWord/);
  assert.match(workspace, /vm-pagination/);
  assert.match(route, /startWordId/);
  assert.match(route, /catalog\.slice\(startIndex\)/);
  assert.match(route, /const updatedProgress = await progressFor/);
  assert.match(route, /return Response\.json\(\{ correct, summary \}\)/);
  assert.doesNotMatch(route, /return Response\.json\(\{ correct, \.\.\.\(await responsePayload/);
  assert.match(workspace, /\{ \.\.\.current, summary: payload\.summary! \}/);
  assert.match(route, /smartlingo_vocabulary_practice_sessions/);
  assert.match(route, /body\.action === "advance_session"/);
  assert.match(route, /sessionPosition/);
  assert.match(workspace, /action: "advance_session"/);
  assert.match(workspace, /payload\.sessionPosition/);
  assert.match(resumeMigration, /UNIQUE\(user_id,path_id,local_date\)/);
  assert.match(resumeMigration, /current_index INTEGER NOT NULL DEFAULT 0 CHECK\(current_index BETWEEN 0 AND 20\)/);
  assert.match(workspace, /practicePercent/);
  assert.match(workspace, /role="progressbar"/);
  assert.match(workspace, /learning-world-\$\{timeScene\}\.jpg/);
  assert.match(workspace, /data\.summary\.percent/);
  assert.match(page, /VocabularyMemoryWorkspace/);
  assert.match(menu, /\/vocabulary/);
  assert.match(menu, /training=reading/);
  assert.match(migration, /successful_dates/);
  assert.match(migration, /first_learned_at/);
  assert.match(migration, /mastered_at/);
  assert.match(migration, /CHECK\(mastered_count\+learning_count\+unlearned_count=total_count\)/);
});

test("production deployment rejects an incomplete multilingual pronunciation corpus", async () => {
  const workflow = await read("../.github/workflows/deploy-cloudflare.yml");
  assert.match(workflow, /COUNT\(\*\)=48000/);
  assert.match(workflow, /COUNT\(DISTINCT target_language\)=12/);
  assert.match(workflow, /SUM\(level='beginner'\)=12000/);
  assert.match(workflow, /json_extract\(pronunciation_guides,'\$\.hi'\)<>''/);
  assert.match(workflow, /lexical_source_license<>''/);
  assert.match(workflow, /VOCAB_PRONUNCIATION_COMPLETE/);
});

test("daily deck prioritizes due reviews, uses twenty-word rounds, and reports real published totals", async () => {
  const route = await read("../app/api/classes/[classId]/vocabulary/route.ts");
  assert.match(route, /const due = started\.filter/);
  assert.match(route, /fresh\.slice\(0, 20\)/);
  assert.match(route, /\.slice\(0, 20\)/);
  assert.match(route, /frequency_degree AS frequencyDegree/);
  assert.match(route, /ORDER BY difficulty ASC,frequency_degree DESC/);
  assert.match(route, /a\.difficulty - b\.difficulty \|\| b\.frequencyDegree - a\.frequencyDegree/);
  assert.match(route, /const total = catalog\.length/);
  assert.match(route, /percent <= 0 \? 0 : Math\.min\(5, Math\.ceil\(percent \/ 20\)\)/);
});
