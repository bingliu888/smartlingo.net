const retiredResponse = () => Response.json(
  {
    error: "This legacy payment endpoint has been retired.",
    code: "LEGACY_PAYMENT_RETIRED",
    charged: false,
  },
  {
    status: 410,
    headers: { "cache-control": "no-store" },
  },
);

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
