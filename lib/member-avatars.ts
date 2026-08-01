import { getDatabase } from "./auth";

export async function avatarsById() {
  try {
    const result = await getDatabase().prepare("SELECT user_id AS userId FROM user_avatars LIMIT 100").run<{ userId: string }>();
    return new Map((result.results || []).map(row => [row.userId, `/api/profile?avatar=${encodeURIComponent(row.userId)}`] as const));
  } catch {
    return new Map<string, string>();
  }
}
