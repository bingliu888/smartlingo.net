import { loadReleaseManifest, releaseNotes } from "./release-manifest.mjs";

const manifest = loadReleaseManifest();
const titleEn = manifest.title.en;
const titleZh = manifest.title.zh;
const notesEn = releaseNotes(manifest, "en");
const notesZh = releaseNotes(manifest, "zh");
const commit = String(process.env.GITHUB_SHA || "").trim();
const runId = String(process.env.GITHUB_RUN_ID || "").trim();
const repository = String(process.env.GITHUB_REPOSITORY || "bingliu888/smartlingo.net").trim();
if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error("GITHUB_SHA must be the exact full 40-character deployment commit.");
if (!/^\d+$/.test(runId)) throw new Error("GITHUB_RUN_ID is required for the exact deployment record.");
const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
const part = type => parts.find(item => item.type === type)?.value || "00";
const editionDate = `${part("year")}-${part("month")}-${part("day")}`;
const timestamp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }).format(now);
const exactEvidenceZh = `精确部署 commit ${commit}；GitHub Actions ${runId}（${runUrl}）`;
const exactEvidenceEn = `Exact deployment commit ${commit}; GitHub Actions ${runId} (${runUrl})`;
const report = {
  date: editionDate,
  title: { zh: `${titleZh} · ${timestamp}`, en: `${titleEn} · ${timestamp}` },
  beta: { zh: "已发布", en: "Published" },
  completed: Math.max(notesZh.length, notesEn.length),
  summary: { zh: notesZh.join("；"), en: notesEn.join("; ") },
  validation: { zh: [...notesZh, exactEvidenceZh], en: [...notesEn, exactEvidenceEn] },
  rollback: {
    zh: "本次没有数据迁移；如需回退，只需恢复上一版 Cloudflare Worker。",
    en: "This release has no data migration; rollback only requires restoring the prior Cloudflare Worker.",
  },
  next: {
    zh: "真实设备麦克风识别、有声朗读及多人实时音视频仍待单独验收。",
    en: "Physical-device microphone recognition, audible speech, and multi-party realtime audio/video remain deferred for separate acceptance.",
  },
};
const build = {
  version: 102,
  date: editionDate,
  title: report.title,
  completed: { zh: notesZh, en: notesEn },
  testable: { zh: ["生产项目报告与部署历史", exactEvidenceZh], en: ["Production Project report and deployment history", exactEvidenceEn] },
  commit,
  runId,
};
const document = { editionDate, today: 2, total: 102, reports: [report], builds: [build] };
const sql = value => `'${String(value).replaceAll("'", "''")}'`;
const reportJson = JSON.stringify(report);
const buildJson = JSON.stringify(build);
const documentJson = JSON.stringify(document);
process.stdout.write(`INSERT INTO editorial_documents(kind,edition_date,payload,updated_at) VALUES('smartlingo-project-status',${sql(editionDate)},${sql(documentJson)},unixepoch()) ON CONFLICT(kind) DO UPDATE SET edition_date=${sql(editionDate)},payload=json_set(editorial_documents.payload,'$.editionDate',${sql(editionDate)},'$.today',COALESCE(json_extract(editorial_documents.payload,'$.today'),1)+1,'$.total',COALESCE(json_extract(editorial_documents.payload,'$.total'),101)+1,'$.reports',json_insert(COALESCE(json_extract(editorial_documents.payload,'$.reports'),json('[]')),'$[#]',json(${sql(reportJson)})),'$.builds',json_insert(COALESCE(json_extract(editorial_documents.payload,'$.builds'),json('[]')),'$[#]',json_set(json(${sql(buildJson)}),'$.version',COALESCE(json_extract(editorial_documents.payload,'$.total'),101)+1))),updated_at=unixepoch();\n`);
