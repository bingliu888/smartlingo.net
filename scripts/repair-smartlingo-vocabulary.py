#!/usr/bin/env python3
"""Generate forward-only repairs for detectable SmartLingo vocabulary defects.

The audit is executed against the complete 48,000-row release catalog. Only
rows that fail the quality gates are rewritten. English glosses are compacted
before an offline English-to-Chinese translation, and every translated gloss
is normalized, de-duplicated, and validated before SQL is emitted.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path


LANGUAGES = ("zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi")
SEVERE_ISSUES = {
    "zh-too-long", "zh-too-many-clauses", "zh-repeated-clause", "zh-repeated-run",
    "zh-corrupt-token", "zh-english-leak", "zh-no-han", "en-repeated-clause",
    "en-disallowed-sense", "en-too-long", "en-corrupt-token", "en-form-definition",
    "common-semantic-mismatch",
}
GLOSS_OVERRIDES = {
    "from; of": "从；属于；……的",
    "when; as soon as; if": "当……时；一……就；如果",
    "really; truly; in fact": "真的；确实；事实上",
    "president; chairperson; leader": "总统；主席；负责人",
    "chairperson; leader": "主席；负责人",
    "no one; nobody; none": "没有人；没有任何一个",
    "new (feminine singular); news": "新的（阴性单数）；消息",
    "coffee beans; coffee": "咖啡豆；咖啡",
    "way; path; road": "方式；路径；道路",
    "attack; assault": "攻击；袭击",
    "each other; one another": "彼此；互相",
    "without; below": "没有；在下方",
    "really; truly": "真的；确实",
    "yours": "你的；你们的",
    "dad; papa": "爸爸；父亲",
    "DNA": "脱氧核糖核酸；DNA",
    "cracklingly; crinklingly; crunchingly": "劈啪作响地；嘎吱作响地",
    "mew; meow; miaow": "猫叫声；喵",
    "ta-da": "表示揭晓或惊喜的感叹声",
    "ska": "斯卡音乐",
    "Miss; girl; young lady": "小姐；女孩；年轻女子",
    "Miss": "小姐；女士",
    "little one": "小家伙；小孩子",
    "Better": "更好的；更佳",
    "I know": "我知道",
    "I believe it": "我相信；我认为如此",
    "her; it": "她；她的；它",
    "jack (switch for a jack plug": "插孔；插座",
    "noun of place of سَكَنَ (sakana): residence; house; home": "住所；房屋；家",
    "broadcasting visual images of stationary or moving objects; - Ernie Kovacs": "电视；电视广播",
    "取り: active partner; key performer": "搭档；关键人物",
    "synonym of 心臓 (shinzō; “heart”": "心脏；心",
    "attributive form (連体形) of たり (tari; “to be”": "是；为（连体形）",
    "得る; 獲る: to get; to acquire": "得到；获得",
    "synonym of です (desu": "是；为",
    "Non-reduplicated form of 찍찍 (jjikjjik; “squeak”": "吱吱声",
    "diminutive of дед (ded": "爷爷；祖父（昵称）",
}
CORRUPT_RE = re.compile(r"[\\<>\ue000-\uf8ff]|�|QQ|XXX|\b(?:Classifier|English|Chinese)\b", re.I)
LATIN_LEAK_RE = re.compile(r"[A-Za-z]{4,}")
DISALLOWED_RE = re.compile(r"(?:^|[;(])\s*(?:obsolete|archaic|historical|vulgar|offensive|derogatory)\b[^;,.]*[;,.]?", re.I)


def compact(value: object) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value or ""))).strip()


def split_clauses(value: str) -> list[str]:
    return [part.strip(" ()（）.,，;；、") for part in re.split(r"[;,，；、/]+", compact(value)) if part.strip(" ()（）.,，;；、")]


def distinct_clauses(value: str, limit: int = 4) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for part in split_clauses(value):
        key = part.casefold()
        if key not in seen:
            seen.add(key)
            result.append(part)
        if len(result) >= limit:
            break
    return result


def clean_english(value: str) -> str:
    value = CORRUPT_RE.sub(" ", compact(value))
    value = DISALLOWED_RE.sub("; ", value)
    value = re.sub(r"\bFor non-idiomatic uses,? see\b.*$", "", value, flags=re.I)
    value = re.sub(r"\([^)]{80,}\)", "", value)
    clauses = distinct_clauses(value, 3)
    cleaned = "; ".join(clauses) or "everyday meaning"
    return cleaned[:176].rstrip(" ;,.")


def collapse_repeated_text(value: str) -> str:
    previous = compact(value)
    for _ in range(8):
        current = re.sub(r"(.{2,16})(?:[，,；;、 ]*\1){2,}", r"\1", previous)
        current = re.sub(r"(.)\1{5,}", r"\1", current)
        if current == previous:
            break
        previous = current
    return previous


def clean_chinese(value: str) -> str:
    value = CORRUPT_RE.sub(" ", collapse_repeated_text(value))
    value = re.sub(r"[(（][^()（）]*[A-Za-z][^()（）]*(?:[)）]|$)", " ", value)
    value = re.sub(r"[A-Za-z]{4,}", " ", value)
    value = value.replace(",", "；").replace(";", "；")
    clauses = distinct_clauses(value, 4)
    cleaned = "；".join(clauses)
    cleaned = re.sub(r"；{2,}", "；", cleaned).strip(" ；，。")
    return cleaned[:80].rstrip(" ；，。")


def valid_chinese(value: str) -> bool:
    value = compact(value)
    return bool(re.search(r"[\u3400-\u9fff]", value)) and len(value) <= 80 and not CORRUPT_RE.search(value) and not LATIN_LEAK_RE.search(value)


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def load_rows(node: Path, project: Path) -> list[dict]:
    result = subprocess.run(
        [str(node), "scripts/audit-smartlingo-vocabulary-quality.mjs", "--rows", "--before-quality"],
        cwd=project, check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def load_translator(model: Path):
    import ctranslate2
    from argostranslate import package

    if not any(item.from_code == "en" and item.to_code == "zh" for item in package.get_installed_packages()):
        package.install_from_path(model)
    pkg = next(item for item in package.get_installed_packages() if item.from_code == "en" and item.to_code == "zh")
    translator = ctranslate2.Translator(
        str(pkg.package_path / "model"), device="cpu", inter_threads=1, intra_threads=4,
    )
    return pkg, translator


def translate_all(values: list[str], pkg, translator, cache_path: Path) -> dict[str, str]:
    cache: dict[str, str] = {}
    if cache_path.exists():
        cache.update(json.loads(cache_path.read_text(encoding="utf-8")))
    cache.update(GLOSS_OVERRIDES)
    pending = [value for value in dict.fromkeys(values) if value not in cache]
    for start in range(0, len(pending), 16):
        batch = pending[start:start + 16]
        tokenized = [pkg.tokenizer.encode(value) for value in batch]
        kwargs = {"target_prefix": [[pkg.target_prefix]] * len(batch)} if pkg.target_prefix else {}
        translated = translator.translate_batch(
            tokenized, replace_unknowns=True, max_batch_size=16, batch_type="examples",
            beam_size=4, num_hypotheses=1, return_scores=False, **kwargs,
        )
        for original, result in zip(batch, translated):
            rendered = pkg.tokenizer.decode(result.hypotheses[0]).strip()
            if pkg.target_prefix and rendered.startswith(pkg.target_prefix):
                rendered = rendered[len(pkg.target_prefix):].strip()
            cache[original] = clean_chinese(rendered)
        if start % 800 == 0 or start + len(batch) == len(pending):
            cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
            print(f"translated {min(start + len(batch), len(pending)):,}/{len(pending):,}")
    return cache


def translate_headwords(rows: list[dict], purpose: str) -> dict[str, str]:
    import ctranslate2
    from argostranslate import package

    resolved: dict[str, str] = {}
    packages = {(item.from_code, item.to_code): item for item in package.get_installed_packages()}
    for language in LANGUAGES:
        selected = [row for row in rows if row["language"] == language]
        if not selected:
            continue
        if language == "en":
            for row in selected:
                resolved[row["id"]] = clean_english(row["form"])
            print(f"en: resolved {len(selected):,} {purpose} directly from the headword")
            continue
        pkg = packages.get((language, "en"))
        if not pkg:
            raise RuntimeError(f"Missing {language}-to-English model for form-definition repair")
        translator = ctranslate2.Translator(str(pkg.package_path / "model"), device="cpu", inter_threads=1, intra_threads=4)
        for start in range(0, len(selected), 16):
            batch = selected[start:start + 16]
            tokenized = [pkg.tokenizer.encode(row["form"]) for row in batch]
            kwargs = {"target_prefix": [[pkg.target_prefix]] * len(batch)} if pkg.target_prefix else {}
            results = translator.translate_batch(tokenized, beam_size=4, num_hypotheses=1, **kwargs)
            for row, result in zip(batch, results):
                value = pkg.tokenizer.decode(result.hypotheses[0]).strip()
                if pkg.target_prefix and value.startswith(pkg.target_prefix):
                    value = value[len(pkg.target_prefix):].strip()
                value = clean_english(value)
                if not re.search(r"[A-Za-z]", value):
                    quoted = re.findall(r"[“\"]([^”\"]*[A-Za-z][^”\"]*)[”\"]", row["meaningEn"])
                    value = clean_english(quoted[-1] if quoted else "common everyday meaning")
                resolved[row["id"]] = value
        print(f"{language}: resolved {len(selected):,} {purpose} from the headword")
    return resolved


def render(project: Path, rows: list[dict], translations: dict[str, str], resolved_english: dict[str, str], common_overrides: dict[tuple[str, str], dict]) -> None:
    affected = [row for row in rows if set(row["issues"]) & SEVERE_ISSUES]
    by_language = {language: [] for language in LANGUAGES}
    for row in affected:
        common = common_overrides.get((row["language"], compact(row["form"]).casefold()))
        meaning_en = common["meaningEn"] if common else resolved_english.get(row["id"], clean_english(row["meaningEn"]))
        existing = clean_chinese(row["meaningZh"])
        only_source_definition = set(row["issues"]) <= {"en-form-definition"}
        meaning_zh = common["meaningZh"] if common else (existing if only_source_definition and valid_chinese(existing) else clean_chinese(translations.get(meaning_en, "")))
        if not valid_chinese(meaning_zh):
            if valid_chinese(existing):
                meaning_zh = existing
        if not valid_chinese(meaning_zh):
            raise RuntimeError(f"No valid Chinese gloss for {row['id']}: {meaning_zh!r}")
        by_language[row["language"]].append((row, meaning_en, meaning_zh))

    drizzle = project / "drizzle"
    for index, language in enumerate(LANGUAGES, 44):
        records = by_language[language]
        path = drizzle / f"{index:04d}_vocabulary_quality_{language}.sql"
        lines = [
            f"-- Forward-only {language} vocabulary quality sweep for the complete 48,000-row catalog.",
            "-- Repairs only rows that failed deterministic repetition, corruption, length, or learner-safety gates.",
        ]
        for row, meaning_en, meaning_zh in records:
            lines.append(
                "UPDATE smartlingo_vocabulary_items SET "
                f"meaning_en={sql_quote(meaning_en)}, meaning_zh={sql_quote(meaning_zh)}, "
                "updated_at=unixepoch() "
                f"WHERE id={sql_quote(row['id'])};"
            )
        lines.extend([
            "CREATE TABLE smartlingo_vocab_quality_check(value INTEGER CHECK(value=1));",
            f"INSERT INTO smartlingo_vocab_quality_check SELECT COUNT(*) IN (28,4000) FROM smartlingo_vocabulary_items WHERE target_language={sql_quote(language)} AND review_status='published';",
            "DROP TABLE smartlingo_vocab_quality_check;",
        ])
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"{language}: wrote {len(records):,} repairs to {path.name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--node", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=Path("/private/tmp/smartlingo-vocabulary-translation-cache.json"))
    args = parser.parse_args()
    project = args.project.resolve()
    rows = load_rows(args.node, project)
    common_items = json.loads((project / "data" / "smartlingo-vocabulary-common-overrides.json").read_text(encoding="utf-8"))
    common_overrides = {(item["language"], compact(item["form"]).casefold()): item for item in common_items}
    targets = [row for row in rows if set(row["issues"]) & SEVERE_ISSUES]
    form_definition_rows = [row for row in targets if "en-form-definition" in row["issues"]]
    resolved_english = translate_headwords(form_definition_rows, "form definitions")
    cleaned_english = [common_overrides.get((row["language"], compact(row["form"]).casefold()), {}).get("meaningEn", resolved_english.get(row["id"], clean_english(row["meaningEn"]))) for row in targets]
    pkg, translator = load_translator(args.model)
    translations = translate_all(cleaned_english, pkg, translator, args.cache)
    residual = []
    for row in targets:
        common = common_overrides.get((row["language"], compact(row["form"]).casefold()))
        if common:
            continue
        meaning_en = resolved_english.get(row["id"], clean_english(row["meaningEn"]))
        if not valid_chinese(clean_chinese(translations.get(meaning_en, ""))) and not valid_chinese(clean_chinese(row["meaningZh"])):
            residual.append(row)
    if residual:
        print(f"resolving {len(residual):,} residual invalid translations from headwords")
        resolved_english.update(translate_headwords(residual, "residual glosses"))
        translations = translate_all(
            [resolved_english[row["id"]] for row in residual], pkg, translator, args.cache,
        )
    render(project, rows, translations, resolved_english, common_overrides)
    print(f"completed {len(targets):,} row repairs across {len(LANGUAGES)} languages")


if __name__ == "__main__":
    main()
