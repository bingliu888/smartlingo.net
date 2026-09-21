import { currentSmartPayCheckoutOptions } from "@/lib/smartpay-checkout-server";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";
import { platformProduct } from "@/lib/platform-commerce";

export async function GET(request: Request) {
  const language = new URL(request.url).searchParams.get("language") || "";
  const product = new URL(request.url).searchParams.get("product") || "";
  if (platformProduct(product)) {
    try {
      const options = await currentSmartPayCheckoutOptions();
      return Response.json({ options: options.filter(option => option.plan === product) }, { headers: { "cache-control": "private, no-store" } });
    } catch { return Response.json({ error: "On-chain payment options are temporarily unavailable" }, { status: 503 }); }
  }
  if (!isSmartLingoCommunityLanguage(language)) {
    return Response.json({ error: "Choose a supported learning language" }, { status: 400 });
  }
  try {
    return Response.json(
      { options: await currentSmartPayCheckoutOptions(undefined, language) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    return Response.json({ error: "On-chain payment options are temporarily unavailable" }, { status: 503 });
  }
}
