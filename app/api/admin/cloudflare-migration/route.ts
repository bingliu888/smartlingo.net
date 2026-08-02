import { cloudflareMigrationExport } from "@/lib/cloudflare-migration";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: Request) {
  return cloudflareMigrationExport(request);
}
