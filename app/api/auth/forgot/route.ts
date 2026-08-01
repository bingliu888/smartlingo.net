export async function POST() {
  return Response.json(
    {
      error: "Legacy password recovery is disabled. Use Clerk account recovery.",
      code: "legacy_auth_disabled",
    },
    { status: 410 },
  );
}
