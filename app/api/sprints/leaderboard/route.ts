import { getDatabase, getSessionUser } from "@/lib/auth";
import { SMARTLINGO_LEARNING_LANGUAGE_CODES, type SmartLingoLearningLanguage } from "@/lib/smartlingo-learning";

export async function GET(request: Request) {
  const url = new URL(request.url); const language = url.searchParams.get("language") || "";
  if (!SMARTLINGO_LEARNING_LANGUAGE_CODES.includes(language as SmartLingoLearningLanguage)) return Response.json({ error: "Valid language required" }, { status: 400 });
  const range = url.searchParams.get("range") === "today" ? "today" : "week";
  const days = range === "today" ? 1 : 7; const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = await getDatabase().prepare(`SELECT run.id,user.display_name AS name,run.score,run.duration_minutes AS durationMinutes,
      run.round_count AS roundCount,run.local_date AS localDate,run.completed_at AS completedAt
    FROM smartlingo_daily_sprint_runs run JOIN users user ON user.id=run.user_id
    WHERE run.target_language=? AND run.status='completed' AND run.completed_at>=?
    ORDER BY run.score DESC,run.round_count DESC,run.completed_at ASC LIMIT 100`).bind(language,since).run();
  const user = await getSessionUser(request); let myBest: { score: number; rank: number } | null = null;
  if (user) {
    const ranked = (rows.results || []) as { id: string; score: number }[];
    const own = await getDatabase().prepare(`SELECT id,score FROM smartlingo_daily_sprint_runs WHERE user_id=? AND target_language=?
      AND status='completed' AND completed_at>=? ORDER BY score DESC,round_count DESC,completed_at ASC LIMIT 1`).bind(user.id,language,since).first<{ id: string; score: number }>();
    if (own) { const index = ranked.findIndex(row => row.id === own.id); myBest = { score: own.score, rank: index >= 0 ? index + 1 : 101 }; }
  }
  return Response.json({ language, range, rankings: (rows.results || []).map((row, index) => ({ ...row, rank: index + 1 })), myBest });
}
