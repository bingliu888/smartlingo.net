import { getDatabase, getSessionUser } from "../../../../lib/auth";
import { isAdmin } from "../../../../lib/admin-access";
import { courseSupervisorIdentity } from "../../../../lib/course-supervisors";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ signedIn: false });
  const avatar = await getDatabase().prepare("SELECT user_id AS userId FROM user_avatars WHERE user_id = ?").bind(user.id).first<{ userId: string }>();
  const supervisor = await courseSupervisorIdentity(user.id, true);
  return Response.json({
    signedIn: true,
    isAdmin: isAdmin(user),
    canSupervise: Boolean(supervisor),
    supervisorRefId: supervisor?.refId || null,
    user: { id: user.id, displayName: user.displayName },
    imageUrl: avatar ? `/api/profile?avatar=${encodeURIComponent(user.id)}` : undefined,
  });
}
