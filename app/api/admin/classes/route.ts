function retired() {
  return Response.json({
    error: "The migrated license-based class-admin API is retired. SmartLingo classes use the member-led language-class model.",
  }, { status: 410 });
}

export const GET = retired;
export const POST = retired;
