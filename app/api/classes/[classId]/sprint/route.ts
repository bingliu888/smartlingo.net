import { createId, getDatabase, getSessionUser } from "@/lib/auth";
import { localDateKey, requireOfficialClassMembership, requirePublicBeginnerSprintCourse, safeTimeZone } from "@/lib/smartlingo-learning-access";
import { SMARTLINGO_LEARNING_LANGUAGE_CODES, type SmartLingoInterfaceLanguage, type SmartLingoLearningLanguage, type SmartLingoLevel } from "@/lib/smartlingo-learning";
import { buildSprintPlan, gradeSprintPlan, sanitizeSprintPlan, SPRINT_DURATIONS, type SprintAnswer, type SprintDuration, type SprintPlan, type SprintVocabulary } from "@/lib/smartlingo-sprint";
import { adaptiveSentenceRounds } from "@/lib/smartlingo-adaptive-sentences";
import { learningReward, nextLearningDay, safeLearningDay } from "@/lib/smartlingo-learning-days";
import { anonymousSprintCookie, parseAnonymousSprintCookie, resumeAnonymousSprintState } from "@/lib/smartlingo-anonymous-sprint";

type Params = { params: Promise<{ classId: string }> };
type Body = { action?: string; durationMinutes?: number; dayNumber?: number; lang?: string; timeZone?: string; runId?: string; responses?: SprintAnswer[]; source?: string; fresh?: boolean; progress?: { roundIndex?: number; stage?: string; wordIndex?: number; responses?: SprintAnswer[]; remainingSeconds?: number } };

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
    const language = value.course.targetLanguage as SmartLingoLearningLanguage; const courseLevel = level(value.course.level);
    const dayNumber = body.dayNumber == null && value.user
      ? await nextLearningDay(value.database, value.user.id, "sprint", courseLevel, language, classId)
      : safeLearningDay(body.dayNumber);
    const resumedAnonymous = value.anonymous && !body.fresh
      ? resumeAnonymousSprintState(parseAnonymousSprintCookie(request.headers.get("cookie")), { classId, language, durationMinutes: selectedDuration, dayNumber }, now)
      : null;
    if (!value.anonymous && value.user) {
      const saved = await value.database.prepare(`SELECT run.id,run.plan_json AS planJson,run.progress_json AS progressJson FROM smartlingo_daily_sprint_runs run
        JOIN smartlingo_daily_sprint_run_days run_day ON run_day.run_id=run.id
        WHERE run.user_id=? AND run.class_id=? AND run.duration_minutes=? AND run_day.day_number=? AND run.status='in_progress' ORDER BY run.started_at DESC LIMIT 1`)
        .bind(value.user.id,classId,selectedDuration,dayNumber).first<{ id: string; planJson: string; progressJson: string }>();
      if (saved) return Response.json({ runId: saved.id, plan: sanitizeSprintPlan(JSON.parse(saved.planJson) as SprintPlan), progress: JSON.parse(saved.progressJson || "{}"), courseTitle: value.course.title, anonymous: false, resumed: true, dayNumber });
    }
    const runId = resumedAnonymous?.runId || createId();
    const vocabularyResult = await value.database.prepare(`SELECT id,form,COALESCE(target_phonetic,pronunciation,'') AS pronunciation,
      CASE WHEN ?='zh' THEN meaning_zh ELSE meaning_en END AS meaning,difficulty,frequency_degree AS frequencyDegree,grade_level AS gradeLevel FROM smartlingo_vocabulary_items
      WHERE target_language=? AND level=? AND review_status='published'
      ORDER BY difficulty ASC,frequency_degree DESC,grade_level ASC,sequence,id LIMIT 1000`)
      .bind(uiLang(body.lang), language, courseLevel).run<SprintVocabulary>();
    const vocabulary = vocabularyResult.results || [];
    const dayStart = (dayNumber - 1) * 20;
    const dayVocabulary = vocabulary.slice(dayStart, dayStart + 20);
    if (dayVocabulary.length < 5) return Response.json({ error: "Course vocabulary is not ready for this learning day" }, { status: 409 });
    const roundVocabulary = Array.from({ length: selectedDuration / 5 }, (_, index) => dayVocabulary.slice(index * 5, index * 5 + 5));
    const adaptive = await adaptiveSentenceRounds({ database: value.database, language, level: courseLevel, uiLang: uiLang(body.lang), roundVocabulary });
    const plan = buildSprintPlan({ runId, language, level: courseLevel, uiLang: uiLang(body.lang), durationMinutes: selectedDuration, vocabulary: dayVocabulary, sentenceRounds: adaptive.rounds, learningReleaseId: adaptive.releaseId, sentenceSource: adaptive.sourceType });
    if (!value.anonymous && value.user) await value.database.batch([
      value.database.prepare(`INSERT INTO smartlingo_daily_sprint_runs
        (id,user_id,class_id,target_language,level,duration_minutes,round_count,local_date,time_zone,plan_json,status,started_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,'in_progress',?)`)
        .bind(runId,value.user.id,classId,language,courseLevel,selectedDuration,plan.rounds.length,localDateKey(now,zone),zone,JSON.stringify(plan),now),
      value.database.prepare(`INSERT INTO smartlingo_daily_sprint_run_days(run_id,day_number,created_at) VALUES(?,?,?)`).bind(runId,dayNumber,now),
    ]);
    const progress = resumedAnonymous ? {
      roundIndex: resumedAnonymous.roundIndex,
      stage: resumedAnonymous.stage,
      wordIndex: resumedAnonymous.wordIndex,
      responses: resumedAnonymous.responses,
      remainingSeconds: resumedAnonymous.remainingSeconds,
    } : undefined;
    const response = Response.json({ runId, plan, progress, courseTitle: value.course.title, anonymous: value.anonymous, resumed: Boolean(resumedAnonymous), dayNumber });
    if (value.anonymous) response.headers.append("Set-Cookie", anonymousSprintCookie(resumedAnonymous || { runId, classId, language, durationMinutes: selectedDuration, dayNumber, roundIndex: 0, stage: "vocabulary", wordIndex: 0, responses: [], remainingSeconds: selectedDuration * 60, updatedAt: now }));
    return response;
  }
  if (body.action === "checkpoint") {
    const progress = body.progress;
    const stages = ["vocabulary","reading","listening","writing","dialogue"];
    if (!body.runId || !progress || !stages.includes(String(progress.stage)) || !Array.isArray(progress.responses)) return Response.json({ error: "Valid Sprint progress is required" }, { status: 400 });
    const safeProgress = { roundIndex: Math.max(0, Math.min(3, Number(progress.roundIndex || 0))), stage: String(progress.stage), wordIndex: Math.max(0, Math.min(4, Number(progress.wordIndex || 0))), responses: progress.responses.slice(0, 4), remainingSeconds: Math.max(0, Math.min(2400, Number(progress.remainingSeconds || 0))) };
    if (value.anonymous || !value.user) {
      const selectedDuration = duration(body.durationMinutes);
      if (!selectedDuration) return Response.json({ error: "Valid Sprint duration is required" }, { status: 400 });
      const language = value.course.targetLanguage as SmartLingoLearningLanguage;
      const response = Response.json({ saved: true, anonymous: true });
      response.headers.append("Set-Cookie", anonymousSprintCookie({ runId: body.runId, classId, language, durationMinutes: selectedDuration, dayNumber: safeLearningDay(body.dayNumber), ...safeProgress, updatedAt: Math.floor(Date.now() / 1000) }));
      return response;
    }
    const saved = await value.database.prepare(`UPDATE smartlingo_daily_sprint_runs SET progress_json=?,checkpointed_at=? WHERE id=? AND user_id=? AND class_id=? AND status='in_progress'`)
      .bind(JSON.stringify(safeProgress),Math.floor(Date.now()/1000),body.runId,value.user.id,classId).run();
    return Response.json({ saved: saved.success });
  }
  if (body.action === "complete") {
    if (value.anonymous || !value.user) return Response.json({ error: "Sign in to save a Sprint score" }, { status: 401 });
    const runId = typeof body.runId === "string" ? body.runId : "";
    const row = await value.database.prepare(`SELECT run.plan_json AS planJson,run.status,run_day.day_number AS dayNumber,run.target_language AS targetLanguage,run.level,run.local_date AS localDate FROM smartlingo_daily_sprint_runs run
      JOIN smartlingo_daily_sprint_run_days run_day ON run_day.run_id=run.id
      WHERE run.id=? AND run.user_id=? AND run.class_id=? LIMIT 1`).bind(runId,value.user.id,classId).first<{ planJson: string; status: string; dayNumber: number; targetLanguage: string; level: SmartLingoLevel; localDate: string }>();
    if (!row) return Response.json({ error: "Sprint not found" }, { status: 404 });
    if (row.status === "completed") return Response.json({ error: "Sprint already completed" }, { status: 409 });
    const plan = JSON.parse(row.planJson) as SprintPlan; const responses = Array.isArray(body.responses) ? body.responses.slice(0, plan.rounds.length) : [];
    if (responses.length !== plan.rounds.length) return Response.json({ error: "Complete every round before submitting" }, { status: 400 });
    const result = gradeSprintPlan(plan, responses); const now = Math.floor(Date.now() / 1000);
    const rewardPoints = await learningReward(value.database,"sprint",level(row.level),result.score);
    await value.database.prepare(`UPDATE smartlingo_daily_sprint_runs SET status='completed',score=?,skill_scores_json=?,completed_at=?
      WHERE id=? AND user_id=? AND status='in_progress'`).bind(result.score,JSON.stringify(result.skillScores),now,runId,value.user.id).run();
    await value.database.prepare(`INSERT INTO smartlingo_learning_score_history
      (id,user_id,feature,level,target_language,class_id,day_number,score,reward_points,local_date,source_id,detail_json,created_at,updated_at)
      VALUES(?,?,'sprint',?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,feature,source_id) DO NOTHING`)
      .bind(createId(),value.user.id,level(row.level),row.targetLanguage,classId,safeLearningDay(row.dayNumber),result.score,rewardPoints,row.localDate,runId,JSON.stringify({ skillScores: result.skillScores, durationMinutes: plan.durationMinutes }),now,now).run();
    return Response.json({ completed: true, ...result, rewardPoints, dayNumber: safeLearningDay(row.dayNumber) });
  }
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
