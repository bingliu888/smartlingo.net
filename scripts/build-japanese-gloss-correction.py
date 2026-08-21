#!/usr/bin/env python3
"""Create a forward-only Beginner Japanese gloss correction from JMdict.

The checked-in catalog remains reproducible history. This release tool reads
its published forms, selects the applicable JMdict sense, translates the short
English learner gloss, and emits id-keyed D1 updates. It never edits an applied
migration.
"""

from __future__ import annotations

import argparse
import gzip
import importlib.util
import json
import re
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path


CORE_ZH = {
    "の": "的；表示所属", "に": "在；向；给；用于表示时间", "で": "在；用；通过", "し": "而且；也（列举理由）",
    "と": "和；与；用于引用", "ない": "不；没有", "だ": "是（简体）", "です": "是（礼貌语）", "する": "做；进行",
    "さ": "程度；名词化后缀", "こと": "事情；事；名词化表达", "いる": "在；有（有生命）", "れ": "被动或可能形式的一部分",
    "ある": "在；有（无生命）", "人": "人", "や": "和；以及（列举）", "日": "日；天；太阳", "いい": "好的；可以",
    "まし": "更好；胜过", "そう": "那样；似乎", "これ": "这个", "じゃ": "那么；那就", "年": "年",
    "的": "目标；靶子；……的", "なる": "成为", "者": "人；……者", "月": "月；月份；月亮", "見": "看；观看",
    "という": "叫作；所谓", "中": "里面；期间；当中", "それ": "那个；那件事", "でも": "但是；即使；例如", "何": "什么",
    "なく": "不；没有（连接形式）", "私": "我", "ため": "为了；由于", "時": "时间；时候", "へ": "向；往", "一": "一；一个",
    "今": "现在", "方": "方向；方法；人（敬称）", "せ": "让；使（动词变化的一部分）", "でき": "完成；产生；能够（词干）",
    "など": "等等；之类", "自分": "自己", "より": "比；从；更加", "俺": "我（男性随意语）", "前": "前面；以前",
    "気": "心情；精神；感觉", "時間": "时间；小时", "どう": "怎样；如何", "また": "又；再次；另外", "もう": "已经；再",
    "目": "眼睛；第……个", "できる": "能；可以；完成", "なり": "成为；一……就；或者", "話": "话；故事；交谈",
    "くれ": "给我；请给（命令形）", "出": "出去；出现；出身", "思う": "想；认为", "分": "部分；分钟；理解",
    "家": "家；房屋", "円": "日元；圆", "後": "后面；之后", "みたい": "像……；似乎", "たち": "……们（复数后缀）",
    "二": "二；两个", "好き": "喜欢；喜爱的", "良い": "好的；可以", "ここ": "这里", "性": "性质；性别；……性",
    "上": "上面；以上；提高", "あれ": "那个（离双方较远）", "様": "样子；情况；对人的敬称", "氏": "先生；女士；氏",
    "ちゃう": "做完；不小心……（口语）", "朝": "早晨；早上", "妻": "妻子；太太", "夫": "丈夫；先生",
    "例えば": "例如；比如", "紹介": "介绍；引见",
}

CORE_EN = {
    "せ": "causative verb stem (make; let)",
    "でき": "to be able to; completion (verb stem)",
    "たち": "plural suffix for people",
    "紹介": "introduction; introducing someone",
}

# Corpus ranking can surface Latin media abbreviations and bare conjugation
# stems. They are not standalone Beginner Japanese learning words, so replace
# them in place with common, dictionary-backed forms absent from this catalog.
FORM_REPLACEMENTS = {
    "M": "探す", "S": "信じる", "食べ": "帰る", "L": "飲む", "探し": "話す", "CM": "書く", "V": "小さい",
    "G": "古い", "U": "食べ物", "信じ": "便利", "行け": "美味しい", "OK": "財布", "PC": "地図", "DVD": "兄", "いら": "姉",
}
REPLACEMENT_IPA = {
    "探す": "/saɡasɯ/", "信じる": "/ɕindʑiɾɯ/", "帰る": "/kaeɾɯ/", "飲む": "/nomɯ/", "話す": "/hanasɯ/",
    "書く": "/kakɯ/", "小さい": "/tɕiːsai/", "古い": "/ɸɯɾɯi/", "食べ物": "/tabemono/", "便利": "/beɴɾi/",
    "美味しい": "/oiɕiː/", "財布": "/saiɸɯ/", "地図": "/tɕizɯ/", "兄": "/ani/", "姉": "/ane/",
}

PRIORITY = {"news1": 100, "ichi1": 90, "spec1": 80, "gai1": 70, "news2": 50, "ichi2": 40}
BAD_MISC = {"archaic", "obsolete term", "dated term", "historical term", "vulgar expression or word", "derogatory"}


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def catalog_rows(path: Path) -> list[tuple[str, str, str]]:
    db = sqlite3.connect(":memory:")
    db.execute("""CREATE TABLE smartlingo_vocabulary_items(
      id TEXT,stable_key TEXT,version TEXT,target_language TEXT,level TEXT,cefr_band TEXT,difficulty INTEGER,
      scene_key TEXT,sequence INTEGER,form TEXT,pronunciation TEXT,meaning_en TEXT,meaning_zh TEXT,item_kind TEXT,
      productive INTEGER,source_type TEXT,review_status TEXT,target_phonetic TEXT,pronunciation_en TEXT,
      pronunciation_zh TEXT,pronunciation_guides TEXT,pronunciation_guide_version TEXT,lexical_source_url TEXT,
      lexical_source_license TEXT,lexical_source_revision TEXT,review_method TEXT,created_at INTEGER,updated_at INTEGER)""")
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("INSERT INTO smartlingo_vocabulary_items"):
            db.execute(line)
    return db.execute("SELECT id,form,meaning_en FROM smartlingo_vocabulary_items WHERE level='beginner' AND sequence BETWEEN 29 AND 1000 ORDER BY sequence").fetchall()


def clean_gloss(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" ;")
    value = re.sub(r"\s*\([^)]{45,}\)", "", value).strip()
    return value[:120].rstrip(" ;,")


def build_jmdict_index(path: Path, wanted: set[str]) -> dict[str, list[tuple[int, str]]]:
    selected: dict[str, list[tuple[int, str]]] = {}
    with gzip.open(path, "rb") as source:
        for _, entry in ET.iterparse(source, events=("end",)):
            if entry.tag != "entry":
                continue
            kanji = [node.text or "" for node in entry.findall("k_ele/keb")]
            readings = [node.text or "" for node in entry.findall("r_ele/reb")]
            matched = wanted.intersection(kanji + readings)
            if not matched:
                entry.clear(); continue
            priorities = [node.text or "" for node in entry.findall("k_ele/ke_pri") + entry.findall("r_ele/re_pri")]
            rank = max([PRIORITY.get(value, 10 if value.startswith("nf") else 0) for value in priorities] + [0])
            for form in matched:
                is_kanji = form in kanji
                for sense in entry.findall("sense"):
                    restrictions = [node.text or "" for node in sense.findall("stagk" if is_kanji else "stagr")]
                    if restrictions and form not in restrictions:
                        continue
                    misc = {node.text or "" for node in sense.findall("misc")}
                    if misc & BAD_MISC:
                        continue
                    glosses = [clean_gloss(node.text or "") for node in sense.findall("gloss") if clean_gloss(node.text or "")]
                    if not glosses:
                        continue
                    gloss = "; ".join(glosses[:2])
                    selected.setdefault(form, []).append((rank, gloss))
            entry.clear()
    return selected


def gloss_words(value: str) -> set[str]:
    return {word for word in re.findall(r"[a-z]{2,}", value.lower()) if word not in {"the", "and", "for", "one", "form"}}


def applicable_gloss(candidates: list[tuple[int, str]], previous: str) -> str:
    previous_words = gloss_words(previous)
    def score(item: tuple[int, str]) -> tuple[float, int]:
        rank, gloss = item
        words = gloss_words(gloss)
        overlap = len(previous_words & words)
        similarity = overlap / max(1, len(previous_words | words))
        return overlap * 100 + similarity * 10 + rank / 100, rank
    return max(candidates, key=score)[1]


def translate(values: list[str]) -> dict[str, str]:
    import ctranslate2
    from argostranslate import translate as argos
    languages = argos.get_installed_languages()
    package_translation = next(item for item in languages if item.code == "en").get_translation(next(item for item in languages if item.code == "zh"))
    while hasattr(package_translation, "underlying"):
        package_translation = package_translation.underlying
    package = package_translation.pkg
    translator = ctranslate2.Translator(str(package.package_path / "model"), device="cpu", inter_threads=1, intra_threads=4)
    result: dict[str, str] = {}
    unique = list(dict.fromkeys(values))
    for start in range(0, len(unique), 128):
        batch = unique[start:start + 128]
        tokens = [package.tokenizer.encode(value) for value in batch]
        prefix = [[package.target_prefix]] * len(tokens) if package.target_prefix else None
        translated = translator.translate_batch(tokens, target_prefix=prefix, replace_unknowns=True, max_batch_size=128, batch_type="examples", beam_size=1)
        for original, item in zip(batch, translated):
            value = package.tokenizer.decode(item.hypotheses[0]).strip()
            if package.target_prefix and value.startswith(package.target_prefix):
                value = value[len(package.target_prefix):].strip()
            value = re.sub(r"(.{1,12})\1{2,}", r"\1", value)
            value = re.sub(r"([^,，；;。]{1,10})(?:[,，；;。]\1){1,}", r"\1", value)
            words: list[str] = []
            for word in value.split():
                if not words or word != words[-1]:
                    words.append(word)
            value = " ".join(words)
            value = re.sub(r"\s+", " ", value).strip(" ;；,，。")
            clauses = [part.strip() for part in re.split(r"[。；;]", value) if part.strip()]
            clauses = list(dict.fromkeys(clauses))
            result[original] = "；".join(clauses[:2])[:50].rstrip("；,，")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--jmdict", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    original_rows = catalog_rows(args.catalog)
    rows = [(item_id, FORM_REPLACEMENTS.get(form, form), old) for item_id, form, old in original_rows]
    dictionary = build_jmdict_index(args.jmdict, {form for _, form, _ in rows})
    missing = [form for _, form, _ in rows if form not in dictionary and form not in CORE_ZH]
    if missing:
        raise SystemExit(f"JMdict coverage missing {len(missing)} Beginner forms: {missing}")
    english = {
        form: CORE_EN.get(form, old if form in CORE_ZH else applicable_gloss(dictionary[form], old))
        for _, form, old in rows
    }
    translated = translate([gloss for form, gloss in english.items() if form not in CORE_ZH])
    lines = [
        "-- Correct Japanese Beginner glosses with applicable JMdict common senses.",
        "-- EDRDG JMdict_e, CC BY-SA 4.0, daily release retrieved 2026-08-20; concise Chinese is an automated translation with curated grammar overrides.",
    ]
    vocab_builder_path = Path(__file__).with_name("build-smartlingo-vocabulary.py")
    spec = importlib.util.spec_from_file_location("smartlingo_vocab_builder", vocab_builder_path)
    if spec is None or spec.loader is None:
        raise SystemExit("Unable to load the shared pronunciation guide builder")
    vocab_builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(vocab_builder)
    for (item_id, old_form, _), (_, form, _) in zip(original_rows, rows):
        meaning_en = english[form]
        meaning_zh = CORE_ZH[form] if form in CORE_ZH else translated[meaning_en]
        if not meaning_zh or len(meaning_zh) > 50 or "QQ" in meaning_zh or re.search(r"(.{2,8})\1{2,}", meaning_zh):
            raise SystemExit(f"unsafe translated gloss for {form}: {meaning_zh}")
        replacements = ""
        if old_form != form:
            ipa = REPLACEMENT_IPA[form]
            guides = vocab_builder.pronunciation_guides(ipa)
            replacements = (
                "form=" + sql_quote(form) + ",pronunciation=" + sql_quote(ipa) + ",target_phonetic=" + sql_quote(ipa) +
                ",pronunciation_en=" + sql_quote(guides["en"]) + ",pronunciation_zh=" + sql_quote(guides["zh"]) +
                ",pronunciation_guides=" + sql_quote(json.dumps(guides, ensure_ascii=False, separators=(",", ":"))) + ","
            )
        lines.append(
            "UPDATE smartlingo_vocabulary_items SET " + replacements + "meaning_en=" + sql_quote(meaning_en) +
            ",meaning_zh=" + sql_quote(meaning_zh) +
            ",lexical_source_url='https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project'" +
            ",lexical_source_license='CC BY-SA 4.0'" +
            ",lexical_source_revision='EDRDG JMdict_e daily release; retrieved 2026-08-20'" +
            ",review_method='jmdict-applicable-common-sense+automated-translation+curated-grammar-overrides'" +
            ",updated_at=unixepoch() WHERE id=" + sql_quote(item_id) + ";"
        )
    lines.extend([
        "CREATE TABLE smartlingo_japanese_gloss_check(value INTEGER CHECK(value=1));",
        "INSERT INTO smartlingo_japanese_gloss_check SELECT COUNT(*)=1000 FROM smartlingo_vocabulary_items WHERE target_language='ja' AND level='beginner' AND review_status='published';",
        "INSERT INTO smartlingo_japanese_gloss_check SELECT COUNT(*)=0 FROM smartlingo_vocabulary_items WHERE target_language='ja' AND level='beginner' AND (length(trim(meaning_zh))=0 OR length(meaning_zh)>50 OR meaning_zh LIKE '%QQ%');",
        "INSERT INTO smartlingo_japanese_gloss_check SELECT COUNT(*)=1 FROM smartlingo_vocabulary_items WHERE target_language='ja' AND form='紹介' AND meaning_zh LIKE '介绍%';",
        "DROP TABLE smartlingo_japanese_gloss_check;",
    ])
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {len(rows)} Japanese Beginner gloss corrections to {args.output}")


if __name__ == "__main__":
    main()
