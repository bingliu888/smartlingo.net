import { getSessionUser } from "../../../lib/auth";
import { isAdmin } from "../../../lib/admin-access";
export async function GET(request:Request){const user=await getSessionUser(request);return Response.json({signedIn:Boolean(user),isAdmin: isAdmin(user), isPermanentAdmin: Boolean(user && user.email.trim().toLowerCase() === "bingliu@cybeye.com")},{headers:{"cache-control":"private, no-store"}})}
