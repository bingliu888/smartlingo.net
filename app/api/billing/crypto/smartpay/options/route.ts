import { currentSmartPayCheckoutOptions } from "@/lib/smartpay-checkout-server";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export async function GET(request: Request) {
  const language = new URL(request.url).searchParams.get("language") || "";
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
