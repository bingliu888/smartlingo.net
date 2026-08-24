import { createId, getDatabase } from "@/lib/auth";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export const dynamic = "force-dynamic";

type Row = { runId:string; localDate:string; userId:string; displayName:string; score:number; updatedAt:number; bonusBasisPoints:number };
type Settlement = { localDate:string; rewardPoints:number; winnerName:string };

function challengeDateClosedGlobally(localDate:string,nowMs=Date.now()){
  return nowMs >= Date.parse(`${localDate}T00:00:00Z`) + 36 * 60 * 60 * 1000;
}
function settlementLanguageKey(language:string,level:string){return level==="beginner"?language:`${language}:${level}`;}

export async function GET(request: Request) {
  const url=new URL(request.url); const month=url.searchParams.get("month")||""; const date=url.searchParams.get("date")||""; const language=url.searchParams.get("language")||""; const level=url.searchParams.get("level")==="intermediate"||url.searchParams.get("level")==="advanced"?url.searchParams.get("level")!:"beginner";
  if(!/^\d{4}-\d{2}$/.test(month)||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))||!isSmartLingoCommunityLanguage(language))return Response.json({error:"Valid month and language are required"},{status:400});
  const database=getDatabase(); const rows=await database.prepare(`SELECT run.id AS runId,run.local_date AS localDate,run.claimed_user_id AS userId,user.display_name AS displayName,run.score,run.updated_at AS updatedAt,run.leader_bonus_basis_points AS bonusBasisPoints FROM smartlingo_smartcard_game_runs run JOIN users user ON user.id=run.claimed_user_id JOIN smartlingo_smartcard_decks deck ON deck.id=run.deck_id WHERE run.claim_status='claimed' AND run.game_mode='challenge' AND deck.target_language=? AND deck.level=? AND run.local_date>=? AND run.local_date<? AND run.score>0 ORDER BY run.local_date,run.score DESC,run.updated_at ASC LIMIT 5000`).bind(language,level,`${month}-01`,`${month}-32`).run<Row>();
  const best=new Map<string,Row>(); for(const row of rows.results||[]){const key=`${row.localDate}:${row.userId}`;const prior=best.get(key);if(!prior||row.score>prior.score||(row.score===prior.score&&row.updatedAt<prior.updatedAt))best.set(key,row);}
  const byDay=new Map<string,Row[]>(); for(const row of best.values()){const list=byDay.get(row.localDate)||[];list.push(row);byDay.set(row.localDate,list);} for(const list of byDay.values())list.sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt);
  const celebrated:{date:string;winnerName:string;score:number;rewardPoints:number}[]=[]; const nowMs=Date.now(); const now=Math.floor(nowMs/1000);const settlementLanguage=settlementLanguageKey(language,level);
  for(const [localDate,list] of byDay){if(!challengeDateClosedGlobally(localDate,nowMs)||!list[0])continue;const winner=list[0];const rewardPoints=Math.min(110,winner.score+Math.round(winner.score*winner.bonusBasisPoints/10000));const settlementId=createId();try{await database.batch([database.prepare(`INSERT INTO smartlingo_smartcard_daily_settlements(id,target_language,local_date,winner_run_id,winner_user_id,winning_score,reward_points,settled_at) VALUES(?,?,?,?,?,?,?,?)`).bind(settlementId,settlementLanguage,localDate,winner.runId,winner.userId,winner.score,rewardPoints,now),database.prepare(`INSERT INTO smartlingo_course_credit_ledger(id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at) VALUES(?,?,?,'smartcard_winner_earn','smartcard_daily_winner',?,?,?,?)`).bind(createId(),winner.userId,rewardPoints,settlementId,localDate,"Daily SmartCard challenge winner",now)]);celebrated.push({date:localDate,winnerName:winner.displayName,score:winner.score,rewardPoints});}catch{/* Another viewer already settled this winner exactly once. */}}
  const settlementRows=await database.prepare(`SELECT settlement.local_date AS localDate,settlement.reward_points AS rewardPoints,user.display_name AS winnerName FROM smartlingo_smartcard_daily_settlements settlement JOIN users user ON user.id=settlement.winner_user_id WHERE settlement.target_language=? AND settlement.local_date>=? AND settlement.local_date<?`).bind(settlementLanguage,`${month}-01`,`${month}-32`).run<Settlement>(); const settlements=new Map((settlementRows.results||[]).map(item=>[item.localDate,item]));
  const days=[...byDay.entries()].map(([localDate,list])=>({date:localDate,topScore:list[0].score,winnerName:list[0].displayName,players:list.length,rewardPoints:settlements.get(localDate)?.rewardPoints||0}));
  const ranking=(date?(byDay.get(date)||[]):[]).slice(0,100).map((row,index)=>({rank:index+1,name:row.displayName,score:row.score}));
  return Response.json({month,language,level,days,ranking,celebrated});
}
