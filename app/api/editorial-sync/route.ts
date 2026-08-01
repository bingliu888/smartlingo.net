import { NextResponse } from "next/server";
import { getDatabase } from "../../../lib/auth";
import { fallbackEvents, fallbackNews, getEditorialDocument, type EditorialDocument } from "../../../lib/editorial-content";

export const dynamic = "force-dynamic";

function validDocument(value: unknown): value is EditorialDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as EditorialDocument;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.editionDate) || !Array.isArray(doc.zh) || !Array.isArray(doc.en)) return false;
  if (doc.zh.length > 12 || doc.en.length > 12 || doc.zh.length !== doc.en.length) return false;
  return [...doc.zh, ...doc.en].every((item) =>
    item && typeof item.title === "string" && item.title.length <= 180 &&
    typeof item.body === "string" && item.body.length <= 800 &&
    typeof item.label === "string" && (!item.url || /^https:\/\//.test(item.url))
  );
}

export async function GET() {
  const [news, events] = await Promise.all([
    getEditorialDocument("news", fallbackNews),
    getEditorialDocument("events", fallbackEvents),
  ]);
  return NextResponse.json({ news, events });
}

export async function PUT(request: Request) {
  const secret = process.env.EDITORIAL_SYNC_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json() as { news?: unknown; events?: unknown };
  if (!validDocument(input.news) || !validDocument(input.events)) return NextResponse.json({ error: "Invalid editorial payload" }, { status: 400 });
  const now = Math.floor(Date.now() / 1000);
  const db = getDatabase();
  for (const [kind, document] of [["news", input.news], ["events", input.events]] as const) {
    await db.prepare("INSERT INTO editorial_documents (kind, edition_date, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind) DO UPDATE SET edition_date = excluded.edition_date, payload = excluded.payload, updated_at = excluded.updated_at")
      .bind(kind, document.editionDate, JSON.stringify(document), now).run();
  }
  return NextResponse.json({ ok: true, editionDate: input.news.editionDate });
}
