export const dynamic = "force-dynamic";

const retiredResponse = () => Response.json(
  {
    error: "This legacy endpoint has moved to the SmartLingo course experience.",
    redirect: "/classes",
  },
  {
    status: 410,
    headers: {
      "cache-control": "no-store",
      link: "</classes>; rel=\"alternate\"",
    },
  },
);

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
