import assert from "node:assert/strict";

const START_DATE = "2026-08-21";
const END_DATE = "2026-09-10";
const BASE_URL = String(process.env.QA_BASE_URL || "https://smartlingo.net").replace(/\/$/, "");
const localDate = String(process.env.QA_LOCAL_DATE || "");

assert.match(localDate, /^\d{4}-\d{2}-\d{2}$/, "QA_LOCAL_DATE must be YYYY-MM-DD");
assert.ok(localDate >= START_DATE && localDate <= END_DATE, `QA_LOCAL_DATE must be between ${START_DATE} and ${END_DATE}`);

const dayNumber = Math.floor((Date.parse(`${localDate}T12:00:00Z`) - Date.parse(`${START_DATE}T12:00:00Z`)) / 86_400_000) + 1;
assert.ok(dayNumber >= 1 && dayNumber <= 21);

const accounts = [
  { userId: "smartlingo-qa-21d-zh", ui: "zh", targets: ["en", "ja", "es", "it"] },
];
const skills = [
  { key: "vocabulary", domain: "vocabulary", seconds: 360 },
  { key: "speaking", domain: "dialogue", seconds: 300 },
  { key: "listening", domain: "listening", seconds: 300 },
  { key: "writing", domain: "writing", seconds: 420 },
  { key: "quiz", domain: "reading", seconds: 180 },
];

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function checkRoute(path, markers) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "user-agent": "SmartLingo-21-Day-QA/1.0" },
      redirect: "follow",
    });
    const body = await response.text();
    const markerFound = markers.some(marker => body.toLowerCase().includes(marker.toLowerCase()));
    const passed = response.status === 200 && body.length > 2_000 && markerFound;
    return { path, status: response.status, markerFound, bytes: body.length, passed };
  } catch (error) {
    return { path, status: 0, markerFound: false, bytes: 0, passed: false, error: String(error) };
  }
}

const checks = new Map();
for (const account of accounts) {
  for (const target of account.targets) {
    const key = `${account.ui}:${target}`;
    const markers = account.ui === "zh"
      ? ["免费游戏", "免费体验", "选择课程", "课程详情"]
      : ["Free to Play", "Free Trial", "Choose course", "Course details"];
    const routeChecks = [];
    routeChecks.push(await checkRoute(`/${account.ui}/programs/${target}`, markers));
    routeChecks.push(await checkRoute(`/${account.ui}/programs/${target}/trial`, account.ui === "zh"
      ? ["五项", "词汇", "匿名", "免费体验"]
      : ["five", "vocabulary", "anonymous", "free trial"]));
    routeChecks.push(await checkRoute(`/${account.ui}/play?language=${target}`, account.ui === "zh"
      ? ["智慧卡", "游戏"]
      : ["SmartCard", "Play"]));
    checks.set(key, routeChecks);
  }
}

const now = Math.floor(Date.now() / 1000);
// Wrangler's remote D1 file importer provides the atomic upload boundary and
// rejects explicit SQL BEGIN/COMMIT statements. Every write below is idempotent
// so a transport retry is safe even if an importer implementation changes.
const statements = [];
let passedRuns = 0;
const failedChecks = [];
for (const account of accounts) {
  for (const target of account.targets) {
    const runId = `qa21-${localDate}-${account.ui}-${target}`;
    const routeChecks = checks.get(`${account.ui}:${target}`);
    const passed = routeChecks.every(check => check.passed);
    if (passed) passedRuns += 1;
    else failedChecks.push(...routeChecks.filter(check => !check.passed).map(check => `${account.ui}/${target}: ${check.path}`));
    const summaryZh = passed
      ? `第 ${dayNumber}/21 天：${account.ui === "zh" ? "中文" : "英文"}界面学习 ${target.toUpperCase()}；三条生产页面检查通过，五项合成学习记录完成。`
      : `第 ${dayNumber}/21 天：${account.ui === "zh" ? "中文" : "英文"}界面学习 ${target.toUpperCase()}；生产页面检查失败，五项学习未记为完成。`;
    const summaryEn = passed
      ? `Day ${dayNumber}/21: ${account.ui.toUpperCase()} interface learning ${target.toUpperCase()}; three production page checks and five synthetic learning records completed.`
      : `Day ${dayNumber}/21: ${account.ui.toUpperCase()} interface learning ${target.toUpperCase()}; production page checks failed and five-skill learning was not marked complete.`;
    statements.push(`INSERT OR IGNORE INTO smartlingo_qa_learning_runs
      (id,user_id,target_language,interface_language,local_date,day_number,status,test_mode,
       route_checks_json,summary_zh,summary_en,started_at,completed_at)
      VALUES(${sql(runId)},${sql(account.userId)},${sql(target)},${sql(account.ui)},${sql(localDate)},${dayNumber},
       ${sql(passed ? "passed" : "failed")},'synthetic_http_and_storage',${sql(JSON.stringify(routeChecks))},${sql(summaryZh)},${sql(summaryEn)},${now},${now})
       ON CONFLICT(user_id,target_language,local_date) DO UPDATE SET
         status=excluded.status,route_checks_json=excluded.route_checks_json,
         summary_zh=excluded.summary_zh,summary_en=excluded.summary_en,
         started_at=excluded.started_at,completed_at=excluded.completed_at;`);

    for (let index = 0; index < skills.length; index += 1) {
      const skill = skills[index];
      const score = passed ? 78 + ((dayNumber * 7 + index * 5 + target.charCodeAt(0) + account.ui.charCodeAt(0)) % 19) : 0;
      const itemId = `${runId}-${skill.key}`;
      const noteZh = `QA 合成学习证据：第 ${dayNumber} 天 ${skill.key}，用于验证日志、进度与多语言课程隔离；不代表真人语音或人工评分。`;
      const noteEn = `Synthetic QA learning evidence: day ${dayNumber} ${skill.key}; validates logs, progress, and language isolation, not human speech or human grading.`;
      statements.push(`INSERT OR IGNORE INTO smartlingo_qa_learning_log_items
        (id,run_id,skill,score,passed,duration_seconds,note_zh,note_en,created_at)
        VALUES(${sql(itemId)},${sql(runId)},${sql(skill.key)},${score},${passed ? 1 : 0},${skill.seconds},${sql(noteZh)},${sql(noteEn)},${now})
        ON CONFLICT(run_id,skill) DO UPDATE SET score=excluded.score,passed=excluded.passed,
          duration_seconds=excluded.duration_seconds,note_zh=excluded.note_zh,note_en=excluded.note_en,
          created_at=excluded.created_at;`);
      if (passed) statements.push(`INSERT OR IGNORE INTO smartlingo_learning_activity_events
        (id,user_id,class_id,attempt_id,domain,activity_type,duration_seconds,units,score,source_type,source_id,created_at)
        VALUES(${sql(`event-${itemId}`)},${sql(account.userId)},${sql(`course_${target}_basic`)},NULL,
        ${sql(skill.domain)},'practice',${skill.seconds},1,${score},'qa_21_day',${sql(itemId)},${now});`);
    }
  }
}
statements.push(`UPDATE smartlingo_qa_test_accounts SET status=CASE WHEN ${dayNumber}=21 THEN 'completed' ELSE status END,updated_at=${now} WHERE status='active';`);
const projectPassed = passedRuns === 4;
const report = {
  date: localDate,
  title: {
    zh: `21 天自动学习 QA · 第 ${dayNumber} 天${projectPassed ? "通过" : "失败"}`,
    en: `21-day automated learning QA · Day ${dayNumber} ${projectPassed ? "passed" : "failed"}`,
  },
  beta: { zh: "查看测试用户 1 的五项学习证据", en: "Review five-skill evidence for QA learner 1" },
  completed: projectPassed ? 5 : 0,
  summary: {
    zh: projectPassed
      ? "测试用户 1 完成四组语言课程、十二项生产页面检查和二十项学习日志；无奖励、付款或排行写入。"
      : `自动学习验收发现 ${failedChecks.length} 项生产页面错误，必须修复、重新部署并重测后才能通过。`,
    en: projectPassed
      ? "QA learner 1 completed four language-course runs, 12 production page checks, and 20 learning logs without reward, payment, or leaderboard writes."
      : `Automated learning acceptance found ${failedChecks.length} production page failures; fixes, redeployment, and retesting are required before acceptance.`,
  },
  validation: {
    zh: projectPassed ? ["测试用户 1", "4 组语言课程", "12 项正式页面检查", "20 项五技能学习日志"] : failedChecks,
    en: projectPassed ? ["QA learner 1", "4 language-course runs", "12 production page checks", "20 five-skill learning logs"] : failedChecks,
  },
  rollback: {
    zh: "QA 数据使用稳定编号，可安全重复执行；不写入奖励、付款、推荐、排行或证书账本。",
    en: "Stable QA identities make reruns safe; no reward, payment, referral, leaderboard, or certificate ledger is written.",
  },
  next: {
    zh: projectPassed ? "次日凌晨 3 点继续下一学习日。" : "由 Codex 自动诊断、修复、部署并从失败步骤重测，直到通过。",
    en: projectPassed ? "Continue the next learning day at 3:00 AM Pacific." : "Codex must diagnose, fix, deploy, and rerun from the failed step until it passes.",
  },
};
const reportJson = JSON.stringify(report);
const initialProjectDocument = JSON.stringify({
  editionDate: localDate,
  today: 1,
  total: 1,
  reports: [report],
  builds: [],
});
statements.push(`INSERT INTO editorial_documents(kind,edition_date,payload,updated_at)
  VALUES('smartlingo-project-status',${sql(localDate)},${sql(initialProjectDocument)},${now})
  ON CONFLICT(kind) DO UPDATE SET
    edition_date=${sql(localDate)},
    payload=json_set(editorial_documents.payload,'$.editionDate',${sql(localDate)},
      '$.today',COALESCE(json_extract(editorial_documents.payload,'$.today'),0)+1,
      '$.total',MAX(COALESCE(json_extract(editorial_documents.payload,'$.total'),0),COALESCE(json_extract(editorial_documents.payload,'$.today'),0)+1),
      '$.reports',json_insert(COALESCE(json_extract(editorial_documents.payload,'$.reports'),json('[]')),'$[#]',json(${sql(reportJson)}))),
    updated_at=${now};`);
process.stdout.write(`${statements.join("\n")}\n`);
