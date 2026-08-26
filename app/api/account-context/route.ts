import { getSessionUser } from "../../../lib/auth";
import { isAdmin, isPermanentAdmin } from "../../../lib/admin-access";
export async function GET(request:Request){const user=await getSessionUser(request);return Response.json({signedIn:Boolean(user),isAdmin: isAdmin(user), isPermanentAdmin: isPermanentAdmin(user)},{headers:{"cache-control":"private, no-store"}})}
