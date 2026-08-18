import { getDatabase } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Row = { localDate: string; userId: string; displayName: string; score: number; updatedAt: number };

export async function GET(request: Request) {
  const url = new URL(request.url); const month = url.searchParams.get("month") || ""; const date = url.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}$/.test(month) || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return Response.json({ error: "Valid month is required" }, { status: 400 });
  const rows = await getDatabase().prepare(`SELECT run.local_date AS localDate,run.claimed_user_id AS userId,user.display_name AS displayName,run.score,run.updated_at AS updatedAt FROM smartlingo_smartcard_game_runs run JOIN users user ON user.id=run.claimed_user_id WHERE run.claim_status='claimed' AND run.game_mode='challenge' AND run.local_date>=? AND run.local_date<? AND run.score>0 ORDER BY run.local_date,run.score DESC,run.updated_at ASC LIMIT 5000`).bind(`${month}-01`,`${month}-32`).run<Row>();
  const best = new Map<string,Row>();
  for (const row of rows.results || []) { const key=`${row.localDate}:${row.userId}`; const prior=best.get(key); if(!prior||row.score>prior.score||(row.score===prior.score&&row.updatedAt<prior.updatedAt))best.set(key,row); }
  const byDay = new Map<string,Row[]>(); for(const row of best.values()){const list=byDay.get(row.localDate)||[];list.push(row);byDay.set(row.localDate,list);}
  const days=[...byDay.entries()].map(([localDate,list])=>{list.sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt);return{date:localDate,topScore:list[0].score,winnerName:list[0].displayName,players:list.length};});
  const ranking=(date?(byDay.get(date)||[]):[]).sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt).slice(0,100).map((row,index)=>({rank:index+1,name:row.displayName,score:row.score}));
  return Response.json({ month,days,ranking });
}
