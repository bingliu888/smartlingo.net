import { headers } from "next/headers";
import { getSessionUser } from "./auth";

export async function requestUser() {
  const requestHeaders = await headers();
  return getSessionUser(new Request("https://smartlingo.net", { headers: { cookie: requestHeaders.get("cookie") ?? "" } }));
}
