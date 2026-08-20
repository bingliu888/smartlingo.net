import { getDatabase, getSessionUser } from "@/lib/auth";
import { isSmartAiGatewayError, transcribeSmartAiSpeech } from "@/lib/smartlingo-ai-gateway";
import { scoreSmartCardPronunciation } from "@/lib/smartlingo-smartcards";

export const dynamic = "force-dynamic";
const MAX_AUDIO_BYTES = 750_000;

type SpeechCard = {
  form: string;
  pronunciation: string;
  targetLanguage: string;
};

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_AUDIO_BYTES + 80_000) return Response.json({ error: "Pronunciation audio is too large" }, { status: 413 });

  const token = (await params).token;
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(token)) return Response.json({ error: "SmartCard deck not found" }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const cardId = form?.get("cardId");
  const audio = form?.get("audio");
  if (typeof cardId !== "string" || cardId.length > 128 || !(audio instanceof File) || audio.size < 256 || audio.size > MAX_AUDIO_BYTES || (audio.type && !audio.type.startsWith("audio/"))) {
    return Response.json({ error: "Pronunciation audio is invalid" }, { status: 400 });
  }

  const database = getDatabase();
  const card = await database.prepare(`SELECT item.form,item.pronunciation,deck.target_language AS targetLanguage
    FROM smartlingo_smartcard_decks deck
    JOIN smartlingo_smartcard_items deck_item ON deck_item.deck_id=deck.id
    JOIN smartlingo_vocabulary_items item ON item.id=deck_item.vocabulary_item_id
    WHERE deck.share_token=? AND deck.visibility IN ('public','unlisted') AND deck.status='active'
      AND item.id=? AND item.review_status='published' LIMIT 1`).bind(token, cardId).first<SpeechCard>();
  if (!card) return Response.json({ error: "SmartCard item not found" }, { status: 404 });

  const user = await getSessionUser(request);
  const guestCookie = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith("sl_guest_cards="))?.slice(15) || "";
  const guestSignal = /^[a-f0-9]{64}$/.test(guestCookie) ? guestCookie : `${request.headers.get("cf-connecting-ip") || "anonymous"}:${request.headers.get("user-agent") || "browser"}`;
  const subject = user ? `user:${user.id}:smartcard-speech` : `guest:${await sha256(guestSignal)}:smartcard-speech`;

  try {
    const result = await transcribeSmartAiSpeech({ subject, audio, language: card.targetLanguage, deps: { database } });
    const transcript = result.value;
    return Response.json({ transcript, ...scoreSmartCardPronunciation(card.form, transcript, card.pronunciation) });
  } catch (error) {
    const status = isSmartAiGatewayError(error) ? error.status : 503;
    return Response.json({ error: "Pronunciation analysis is temporarily unavailable" }, { status });
  }
}
