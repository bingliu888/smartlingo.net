import { NextResponse } from "next/server";
import { getDatabase } from "../../../lib/auth";
import { getProjectRuntime, PROJECT_RUNTIME_KEY, validProjectRuntime } from "../../../lib/project-runtime";

export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await getProjectRuntime()); }
export async function PUT(request: Request) {
  const secret = process.env.EDITORIAL_SYNC_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const document = await request.json() as unknown;
  if (!validProjectRuntime(document)) return NextResponse.json({ error: "Invalid project status payload" }, { status: 400 });
  const current = await getProjectRuntime();
  if (document.editionDate < current.editionDate || (document.editionDate === current.editionDate && document.total < current.total)) return NextResponse.json({ error: "Project status payload is older than the current deployment record" }, { status: 409 });
  await getDatabase().prepare("INSERT INTO editorial_documents (kind, edition_date, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind) DO UPDATE SET edition_date = excluded.edition_date, payload = excluded.payload, updated_at = excluded.updated_at").bind(PROJECT_RUNTIME_KEY, document.editionDate, JSON.stringify(document), Math.floor(Date.now() / 1000)).run();
  return NextResponse.json({ ok: true, editionDate: document.editionDate, today: document.today, total: document.total });
}
