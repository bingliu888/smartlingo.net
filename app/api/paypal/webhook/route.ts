const retiredResponse = () => Response.json(
  {
    error: "This legacy PayPal webhook has been retired.",
    code: "LEGACY_PAYMENT_RETIRED",
    processed: false,
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
