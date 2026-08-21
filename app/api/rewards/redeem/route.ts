import { createId, getDatabase, getSessionUser } from "@/lib/auth";

type RewardItem = { id: string; titleZh: string; titleEn: string; descriptionZh: string; descriptionEn: string; icon: string; points: number; itemType: string };

async function context(request: Request) {
  const user = await getSessionUser(request); if (!user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) } as const;
  const database = getDatabase();
  const balance = await database.prepare("SELECT COALESCE(SUM(points),0) AS points FROM smartlingo_course_credit_ledger WHERE user_id=?").bind(user.id).first<{ points: number }>();
  return { user, database, balancePoints: Number(balance?.points || 0) } as const;
}

export async function GET(request: Request) {
  const value = await context(request); if ("error" in value) return value.error;
  const items = await value.database.prepare(`SELECT id,title_zh AS titleZh,title_en AS titleEn,description_zh AS descriptionZh,
    description_en AS descriptionEn,icon,points,item_type AS itemType FROM smartlingo_digital_reward_items WHERE status='active' ORDER BY sort_order,id`).run<RewardItem>();
  const owned = await value.database.prepare(`SELECT redemption.item_id AS itemId,redemption.created_at AS createdAt
    FROM smartlingo_digital_reward_redemptions redemption WHERE redemption.user_id=? AND redemption.status='owned'`).bind(value.user.id).run<{ itemId: string; createdAt: number }>();
  return Response.json({ balancePoints: value.balancePoints, items: items.results || [], owned: owned.results || [] });
}

export async function POST(request: Request) {
  const value = await context(request); if ("error" in value) return value.error;
  const body = await request.json().catch(() => null) as { itemId?: string } | null; const itemId = String(body?.itemId || "");
  const item = await value.database.prepare(`SELECT id,title_en AS titleEn,points FROM smartlingo_digital_reward_items WHERE id=? AND status='active' LIMIT 1`).bind(itemId).first<{ id: string; titleEn: string; points: number }>();
  if (!item) return Response.json({ error: "Reward item not found" }, { status: 404 });
  const existing = await value.database.prepare("SELECT id FROM smartlingo_digital_reward_redemptions WHERE user_id=? AND item_id=? AND status='owned' LIMIT 1").bind(value.user.id,item.id).first();
  if (existing) return Response.json({ error: "You already own this item" }, { status: 409 });
  if (value.balancePoints < item.points) return Response.json({ error: "Not enough reward points", balancePoints: value.balancePoints }, { status: 409 });
  const now = Math.floor(Date.now() / 1000); const redemptionId = createId(); const localDate = new Date(now * 1000).toISOString().slice(0,10);
  try {
    await value.database.batch([
      value.database.prepare(`INSERT INTO smartlingo_digital_reward_redemptions(id,user_id,item_id,points,status,created_at,updated_at)
        VALUES(?,?,?,?,'owned',?,?)`).bind(redemptionId,value.user.id,item.id,item.points,now,now),
      value.database.prepare(`INSERT INTO smartlingo_course_credit_ledger(id,user_id,points,entry_type,source_type,source_id,local_date,note,created_at)
        VALUES(?,?,?,'digital_redeem','digital_reward',?,?,?,?)`).bind(createId(),value.user.id,-item.points,redemptionId,localDate,`Digital reward: ${item.titleEn}`,now),
    ]);
  } catch { return Response.json({ error: "Unable to redeem this item safely" }, { status: 409 }); }
  return Response.json({ redeemed: true, itemId: item.id, pointsUsed: item.points, balancePoints: value.balancePoints - item.points });
}
