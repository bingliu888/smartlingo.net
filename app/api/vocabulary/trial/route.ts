import { getDatabase } from "@/lib/auth";
import { isSmartLingoCommunityLanguage } from "@/lib/smartlingo-language-communities";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  targetLanguage: string;
  sequence: number;
  form: string;
  pronunciation: string;
  targetPhonetic: string;
  pronunciationEn: string;
  pronunciationZh: string;
  pronunciationGuides: string;
  meaningEn: string;
  meaningZh: string;
  sceneKey: string;
};

function guides(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

function dailyDeck(catalog: Row[], date: string) {
  const seed = Number(date.replaceAll("-", "")) || 1;
  const ordered = [...catalog].sort((left, right) => {
    const leftRank = (left.sequence * 37 + seed * 17) % Math.max(1, catalog.length);
    const rightRank = (right.sequence * 37 + seed * 17) % Math.max(1, catalog.length);
    return leftRank - rightRank || left.sequence - right.sequence;
  });
  return ordered.slice(0, 10).map((item, index) => {
    const alternatives = catalog
      .filter(candidate => candidate.id !== item.id)
      .sort((left, right) => ((left.sequence * 19 + item.sequence * 11) % 101) - ((right.sequence * 19 + item.sequence * 11) % 101))
      .slice(0, 3);
    const options = [item, ...alternatives]
      .sort((left, right) => ((left.sequence * 13 + index * 7) % 43) - ((right.sequence * 13 + index * 7) % 43))
      .map(option => ({ id: option.id, form: option.form, meaningEn: option.meaningEn, meaningZh: option.meaningZh }));
    return { ...item, pronunciationGuides: guides(item.pronunciationGuides), direction: item.targetLanguage === "ar" ? "rtl" : "ltr", options };
  });
}

export async function GET(request: Request) {
  const language = new URL(request.url).searchParams.get("language") || "";
  if (!isSmartLingoCommunityLanguage(language)) {
    return Response.json({ error: "A supported language is required" }, { status: 400 });
  }
  const database = getDatabase();
  const result = await database.prepare(`SELECT id,target_language AS targetLanguage,sequence,form,pronunciation,
    target_phonetic AS targetPhonetic,pronunciation_en AS pronunciationEn,pronunciation_zh AS pronunciationZh,
    pronunciation_guides AS pronunciationGuides,meaning_en AS meaningEn,meaning_zh AS meaningZh,scene_key AS sceneKey
    FROM smartlingo_vocabulary_items
    WHERE target_language=? AND level='beginner' AND review_status='published'
    ORDER BY sequence,id`).bind(language).run<Row>();
  const catalog = result.results || [];
  const items = catalog.map(item => ({
    id: item.id,
    form: item.form,
    targetPhonetic: item.targetPhonetic,
    meaningEn: item.meaningEn,
    meaningZh: item.meaningZh,
    sceneKey: item.sceneKey,
    direction: item.targetLanguage === "ar" ? "rtl" : "ltr",
  }));
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return Response.json({
    localDate,
    targetLanguage: language,
    summary: { total: catalog.length, mastered: 0, learning: 0, unlearned: catalog.length, percent: 0, stars: 0 },
    dailyDeck: dailyDeck(catalog, localDate),
    items,
  }, { headers: { "cache-control": "public, max-age=300" } });
}
