import { currentSmartPayCheckoutOptions } from "@/lib/smartpay-checkout-server";
import { platformProduct } from "@/lib/platform-commerce";

export async function GET(request: Request) {
  const product = new URL(request.url).searchParams.get("product") || "";
  if (platformProduct(product)) {
    try {
      const options = await currentSmartPayCheckoutOptions();
      return Response.json({ options: options.filter(option => option.plan === product) }, { headers: { "cache-control": "private, no-store" } });
    } catch { return Response.json({ error: "On-chain payment options are temporarily unavailable" }, { status: 503 }); }
  }
  return Response.json({ error: "Choose a Max plan or AIGC credit pack" }, { status: 400 });
}
