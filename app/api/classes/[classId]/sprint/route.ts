import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { localDateKey, requireOfficialClassMembership, requirePublicBeginnerSprintCourse, safeTimeZone } from "@/lib/smartlingo-learning-access";
import { SMARTLINGO_LEARNING_LANGUAGE_CODES, type SmartLingoInterfaceLanguage, type SmartLingoLearningLanguage, type SmartLingoLevel } from "@/lib/smartlingo-learning";
import { buildSprintPlan, gradeSprintPlan, SPRINT_DURATIONS, type SprintAnswer, type SprintDuration, type SprintPlan, type SprintVocabulary } from "@/lib/smartlingo-sprint";
import { adaptiveSentenceRounds } from "@/lib/smartlingo-adaptive-sentences";

type Params = { params: Promise<{ classId: string }> };
type Body = { action?: string; durationMinutes?: number; lang?: string; timeZone?: string; runId?: string; responses?: SprintAnswer[]; source?: string; progress?: { roundIndex?: number; stage?: string; wordIndex?: number; responses?: SprintAnswer[]; remainingSeconds?: number } };

const ANONYMOUS_SPRINT_COOKIE = "smartlingo-anonymous-sprint";
function anonymousSprintCookie(value: object) {
  return `${ANONYMOUS_SPRINT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7200`;
}

function level(value: string): SmartLingoLevel { return value === "advanced" || value === "intermediate" ? value : "beginner"; }
function uiLang(value: string | undefined): SmartLingoInterfaceLanguage { return value === "en" ? "en" : "zh"; }
function duration(value: number | undefined): SprintDuration | null { return SPRINT_DURATIONS.includes(value as SprintDuration) ? value as SprintDuration : null; }

async function access(request: Request, classId: string, publicPlay: boolean) {
  const user = await getSessionUser(request);
  const database = getDatabase();
  if (publicPlay) {
    const course = await requirePublicBeginnerSprintCourse(database, classId);
    if (!course || !SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(course.targetLanguage as SmartLingoLearningLanguage)) return { error: Response.json({ error: "Open Beginner Sprint not found" }, { status: 404 }) } as const;
    return { user, database, course, anonymous: !user } as const;
  }
  if (!user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const course = await requireOfficialClassMembership(database, user, classId);
  if (!course || !SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(course.targetLanguage as SmartLingoLearningLanguage)) return { error: Response.json({ error: "Active course access required" }, { status: 403 }) } as const;
  return { user, database, course, anonymous: false } as const;
}

export async function POST(request: Request, { params }: Params) {
  const { classId } = await params;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });
  const value = await access(request, classId, body.source === "play"); if ("error" in value) return value.error;
  if (body.action === "start") {
    const selectedDuration = duration(body.durationMinutes); if (!selectedDuration) return Response.json({ error: "Choose 5, 10, 15, or 20 minutes" }, { status: 400 });
    const zone = safeTimeZone(body.timeZone || "UTC"); const now = Math.floor(Date.now() / 1000);
    if (!value.anonymous && value.user) {
      const saved = await value.database.prepare(`SELECT id,plan_json AS planJson,progress_json AS progressJson FROM smartlingo_daily_sprint_runs
        WHERE user_id=? AND class_id=? AND duration_minutes=? AND status='in_progress' ORDER BY started_at DESC LIMIT 1`)
        .bind(value.user.id,classId,selectedDuration).first<{ id: string; planJson: string; progressJson: string }>();
      if (saved) return Response.json({ runId: saved.id, plan: JSON.parse(saved.planJson), progress: JSON.parse(saved.progressJson || "{}"), courseTitle: value.course.title, anonymous: false, resumed: true });
    }
    const runId = createId();
    const language = value.course.targetLanguage as SmartLingoLearningLanguage; const courseLevel = level(value.course.level);
    const vocabularyResult = await value.database.prepare(`SELECT id,form,COALESCE(target_phonetic,pronunciation,'') AS pronunciation,
      CASE WHEN ?='zh' THEN meaning_zh ELSE meaning_en END AS meaning,difficulty,frequency_degree AS frequencyDegree FROM smartlingo_vocabulary_items
      WHERE target_language=? AND level=? AND review_status='published'
      ORDER BY difficulty ASC,frequency_degree DESC,sequence,id LIMIT 1000`)
      .bind(uiLang(body.lang), language, courseLevel).run<SprintVocabulary>();
    const vocabulary = vocabularyResult.results || [];
    if (vocabulary.length < 5) return Response.json({ error: "Course vocabulary is not ready" }, { status: 409 });
    const roundVocabulary = Array.from({ length: selectedDuration / 5 }, (_, index) => vocabulary.slice(index * 5, index * 5 + 5));
    const adaptive = await adaptiveSentenceRounds({ database: value.database, language, level: courseLevel, uiLang: uiLang(body.lang), roundVocabulary });
    const plan = buildSprintPlan({ runId, language, level: courseLevel, uiLang: uiLang(body.lang), durationMinutes: selectedDuration, vocabulary, sentenceRounds: adaptive.rounds, learningReleaseId: adaptive.releaseId, sentenceSource: adaptive.sourceType });
    if (!value.anonymous && value.user) await value.database.prepare(`INSERT INTO smartlingo_daily_sprint_runs
      (id,user_id,class_id,target_language,level,duration_minutes,round_count,local_date,time_zone,plan_json,status,started_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,'in_progress',?)`)
      .bind(runId,value.user.id,classId,language,courseLevel,selectedDuration,plan.rounds.length,localDateKey(now,zone),zone,JSON.stringify(plan),now).run();
    const response = Response.json({ runId, plan, courseTitle: value.course.title, anonymous: value.anonymous });
    if (value.anonymous) response.headers.append("Set-Cookie", anonymousSprintCookie({ runId, classId, language, durationMinutes: selectedDuration, roundIndex: 0, stage: "vocabulary", wordIndex: 0, remainingSeconds: selectedDuration * 60 }));
    return response;
  }
  if (body.action === "checkpoint") {
    const progress = body.progress;
    const stages = ["vocabulary","reading","listening","writing","dialogue"];
    if (!body.runId || !progress || !stages.includes(String(progress.stage)) || !Array.isArray(progress.responses)) return Response.json({ error: "Valid Sprint progress is required" }, { status: 400 });
    const safeProgress = { roundIndex: Math.max(0, Math.min(3, Number(progress.roundIndex || 0))), stage: String(progress.stage), wordIndex: Math.max(0, Math.min(4, Number(progress.wordIndex || 0))), responses: progress.responses.slice(0, 4), remainingSeconds: Math.max(0, Math.min(2400, Number(progress.remainingSeconds || 0))) };
    if (value.anonymous || !value.user) {
      const response = Response.json({ saved: true, anonymous: true });
      response.headers.append("Set-Cookie", anonymousSprintCookie({ runId: body.runId, classId, ...safeProgress }));
      return response;
    }
    const saved = await value.database.prepare(`UPDATE smartlingo_daily_sprint_runs SET progress_json=?,checkpointed_at=? WHERE id=? AND user_id=? AND class_id=? AND status='in_progress'`)
      .bind(JSON.stringify(safeProgress),Math.floor(Date.now()/1000),body.runId,value.user.id,classId).run();
    return Response.json({ saved: saved.success });
  }
  if (body.action === "complete") {
    if (value.anonymous || !value.user) return Response.json({ error: "Sign in to save a Sprint score" }, { status: 401 });
    const runId = typeof body.runId === "string" ? body.runId : "";
    const row = await value.database.prepare(`SELECT plan_json AS planJson,status FROM smartlingo_daily_sprint_runs
      WHERE id=? AND user_id=? AND class_id=? LIMIT 1`).bind(runId,value.user.id,classId).first<{ planJson: string; status: string }>();
    if (!row) return Response.json({ error: "Sprint not found" }, { status: 404 });
    if (row.status === "completed") return Response.json({ error: "Sprint already completed" }, { status: 409 });
    const plan = JSON.parse(row.planJson) as SprintPlan; const responses = Array.isArray(body.responses) ? body.responses.slice(0, plan.rounds.length) : [];
    if (responses.length !== plan.rounds.length) return Response.json({ error: "Complete every round before submitting" }, { status: 400 });
    const result = gradeSprintPlan(plan, responses); const now = Math.floor(Date.now() / 1000);
    await value.database.prepare(`UPDATE smartlingo_daily_sprint_runs SET status='completed',score=?,skill_scores_json=?,completed_at=?
      WHERE id=? AND user_id=? AND status='in_progress'`).bind(result.score,JSON.stringify(result.skillScores),now,runId,value.user.id).run();
    return Response.json({ completed: true, ...result });
  }
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
