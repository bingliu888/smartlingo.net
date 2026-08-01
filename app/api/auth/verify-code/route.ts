export async function POST() {
  return Response.json(
    {
      error: "Legacy email-code authentication is disabled. Use Clerk sign-in.",
      code: "legacy_auth_disabled",
    },
    { status: 410 },
  );
}
