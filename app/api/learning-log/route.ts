import { getDatabase, getSessionUser } from "../../../lib/auth";
import { localDateKey, safeTimeZone } from "../../../lib/smartlingo-learning-access";

export const dynamic = "force-dynamic";

type ActivityRow = {
  domain: "vocabulary" | "reading" | "writing" | "listening" | "dialogue" | "community";
  durationSeconds: number;
  score: number | null;
  occurredAt: number;
};

const domains = ["vocabulary", "reading", "writing", "listening", "dialogue"] as const;

function validMonth(value: string | null) {
  return value && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value) ? value : null;
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const url = new URL(request.url);
  const month = validMonth(url.searchParams.get("month"));
  if (!month) return Response.json({ error: "A valid YYYY-MM month is required" }, { status: 400 });
  const timeZone = safeTimeZone(url.searchParams.get("timeZone"));
  const classId = (url.searchParams.get("classId") || "").trim().slice(0, 100);
  const [year, monthNumber] = month.split("-").map(Number);
  const rangeStart = Math.floor(Date.UTC(year, monthNumber - 1, 1) / 1000) - (2 * 86_400);
  const rangeEnd = Math.floor(Date.UTC(year, monthNumber, 1) / 1000) + (2 * 86_400);
  const database = getDatabase();
  const result = classId
    ? await database.prepare(`SELECT domain, duration_seconds AS durationSeconds,
        score, created_at AS occurredAt
        FROM smartlingo_learning_activity_events
        WHERE user_id = ? AND class_id = ? AND created_at >= ? AND created_at < ?
        ORDER BY created_at`).bind(user.id, classId, rangeStart, rangeEnd).run<ActivityRow>()
    : await database.prepare(`SELECT domain, duration_seconds AS durationSeconds,
        score, created_at AS occurredAt
        FROM smartlingo_learning_activity_events
        WHERE user_id = ? AND created_at >= ? AND created_at < ?
        ORDER BY created_at`).bind(user.id, rangeStart, rangeEnd).run<ActivityRow>();

  const byDay = new Map<string, {
    date: string;
    domains: Record<string, { count: number; minutes: number; averageScore: number | null }>;
    communityCount: number;
    scoreTotals: Record<string, { total: number; count: number }>;
  }>();
  for (const row of result.results || []) {
    const date = localDateKey(Number(row.occurredAt), timeZone);
    if (!date.startsWith(`${month}-`)) continue;
    const day = byDay.get(date) ?? {
      date,
      domains: Object.fromEntries(domains.map(domain => [domain, { count: 0, minutes: 0, averageScore: null }])),
      communityCount: 0,
      scoreTotals: {},
    };
    if (row.domain === "community") day.communityCount += 1;
    else if (domains.includes(row.domain as typeof domains[number])) {
      const metric = day.domains[row.domain];
      metric.count += 1;
      metric.minutes += Math.max(0, Math.round(Number(row.durationSeconds || 0) / 60));
      if (row.score !== null && Number.isFinite(Number(row.score))) {
        const score = day.scoreTotals[row.domain] ?? { total: 0, count: 0 };
        score.total += Number(row.score);
        score.count += 1;
        day.scoreTotals[row.domain] = score;
        metric.averageScore = Math.round(score.total / score.count);
      }
    }
    byDay.set(date, day);
  }
  const days = [...byDay.values()].sort((left, right) => left.date.localeCompare(right.date)).map(day => ({
    date: day.date,
    domains: day.domains,
    communityCount: day.communityCount,
  }));
  return Response.json({ month, timeZone, classId: classId || null, days });
}
