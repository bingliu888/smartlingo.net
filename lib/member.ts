import { getSessionUser } from "./auth";
import { isPermanentAdmin } from "./admin-access";

export async function requirePermanentAdmin(request?: Request) {
  const user = await getSessionUser(request);
  if (!isPermanentAdmin(user)) {
    throw new Response(JSON.stringify({ error: "Permanent administrator access required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}
