#!/usr/bin/env python3
"""Reproducible SmartLingo vocabulary catalog builder.

Selection uses wordfreq's corpus ranks. Lexical senses and dictionary IPA come
from English Wiktionary via Kaikki/Wiktextract. Missing IPA is filled by eSpeak
NG. The generated catalog records the upstream URL, license, revision, and the
automated review method; it never claims human review.

This script is an offline release tool, not a production runtime dependency.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

from wordfreq import top_n_list

LANGUAGES = ("zh", "en", "es", "ja", "ko", "fr", "de", "ru", "it", "pt", "ar", "hi")
LANGUAGE_NAMES = {
    "zh": "Chinese", "en": "English", "es": "Spanish", "ja": "Japanese", "ko": "Korean",
    "fr": "French", "de": "German", "ru": "Russian", "it": "Italian", "pt": "Portuguese",
    "ar": "Arabic", "hi": "Hindi",
}
ALLOWED_POS = {"noun", "verb", "adj", "adv", "pron", "det", "prep", "postp", "conj", "interj", "num", "phrase"}
DISALLOWED_TAGS = {"obsolete", "archaic", "historical", "dated", "rare", "vulgar", "offensive", "derogatory"}
ESPEAK_VOICES = {"zh": "cmn", "en": "en-us", "es": "es", "ja": "ja", "ko": "ko", "fr": "fr-fr", "de": "de", "ru": "ru", "it": "it", "pt": "pt-br", "ar": "ar", "hi": "hi"}
SCENES = ("core-grammar", "people", "home", "food", "travel", "health", "study", "work", "community", "nature", "technology", "ideas")

# WordNet intentionally focuses on content words, so its first entry for a
# short function word can be an abbreviation ("IN" = Indiana, "Be" =
# beryllium) instead of the everyday grammatical use. These compact glosses
# cover the high-frequency closed class explicitly; content words below are
# sense-ranked with WordNet's corpus lemma counts.
ENGLISH_CORE_GLOSSES = {
    "the": ("the definite article", "定冠词；特指已知的人或事物"), "to": ("toward; used before an infinitive", "向；到；用于动词不定式"),
    "and": ("used to join words or ideas", "和；以及"), "of": ("belonging to; relating to", "……的；关于"),
    "a": ("one; an indefinite article", "一个；不定冠词"), "an": ("one; an indefinite article before a vowel sound", "一个；用于元音音素前的不定冠词"),
    "in": ("inside; within", "在……里面；在……期间"), "on": ("on the surface of; about", "在……上面；关于"),
    "at": ("in or near a place or time", "在某地点或时间"), "for": ("intended for; because of", "为了；给；因为"),
    "from": ("starting at; originating in", "从；来自"), "with": ("together with; using", "和……一起；用"),
    "by": ("near; through the action of", "在旁边；由；通过"), "as": ("in the role of; while", "作为；像；当……时"),
    "into": ("to the inside of", "进入；到……里面"), "between": ("in the space separating two things", "在两者之间"),
    "under": ("below; subject to", "在……下面；在……之下"), "during": ("throughout a period of time", "在……期间"),
    "without": ("not having; not using", "没有；不使用"), "against": ("in opposition to; touching", "反对；靠着"),
    "after": ("later than; following", "在……之后"), "before": ("earlier than", "在……之前"),
    "through": ("from one side or end to the other", "穿过；从头到尾"), "around": ("surrounding; approximately", "围绕；大约"),
    "i": ("the speaker", "我"), "you": ("the person or people being addressed", "你；你们"), "he": ("a male person already mentioned", "他"),
    "she": ("a female person already mentioned", "她"), "it": ("a thing or situation already mentioned", "它；这件事"),
    "we": ("the speaker and one or more other people", "我们"), "they": ("people or things already mentioned", "他们；她们；它们"),
    "me": ("the speaker as an object", "我（宾格）"), "him": ("a male person as an object", "他（宾格）"),
    "her": ("a female person as an object; belonging to her", "她（宾格）；她的"), "us": ("the speaker and others as an object", "我们（宾格）"),
    "them": ("people or things as an object", "他们；她们；它们（宾格）"), "my": ("belonging to me", "我的"),
    "your": ("belonging to you", "你的；你们的"), "his": ("belonging to him", "他的"), "its": ("belonging to it", "它的"),
    "our": ("belonging to us", "我们的"), "their": ("belonging to them", "他们的；她们的；它们的"),
    "this": ("the person or thing here", "这个；这"), "that": ("the person or thing there; used to introduce a clause", "那个；那；引导从句"),
    "these": ("the people or things here", "这些"), "those": ("the people or things there", "那些"),
    "who": ("what person or people", "谁；……的人"), "what": ("what thing or information", "什么"),
    "which": ("what one or ones", "哪一个；哪些"), "where": ("in or at what place", "在哪里；……的地方"),
    "when": ("at what time; at the time that", "什么时候；当……时"), "why": ("for what reason", "为什么"), "how": ("in what way", "怎样；如何"),
    "be": ("to exist; to have a quality or identity", "是；存在；成为"), "am": ("first-person singular form of be", "是（用于 I）"),
    "is": ("third-person singular form of be", "是（第三人称单数）"), "are": ("present plural form of be", "是（复数或第二人称）"),
    "was": ("past singular form of be", "是；在（过去式单数）"), "were": ("past plural form of be", "是；在（过去式复数）"),
    "been": ("past participle of be", "be 的过去分词；曾经是"), "can": ("to be able to; to be allowed to", "能；可以"),
    "could": ("past or conditional form of can", "能；可以（过去式或委婉语气）"), "may": ("to be allowed to; possibly", "可以；可能"),
    "might": ("possibly; a less certain form of may", "可能；也许"), "must": ("to be required to; certainly", "必须；一定"),
    "will": ("used for the future or willingness", "将会；愿意"), "would": ("used for a conditional or polite request", "会；愿意（条件或委婉语气）"),
    "should": ("used for advice or expectation", "应该；应当"), "do": ("to perform an action; used to form questions and negatives", "做；用于构成疑问和否定"),
    "does": ("third-person singular form of do", "do 的第三人称单数；做"), "did": ("past form of do", "do 的过去式；做了"),
    "have": ("to own; to experience", "有；拥有；经历"), "has": ("third-person singular form of have", "have 的第三人称单数；有"),
    "had": ("past form of have", "have 的过去式；有过"), "not": ("used to make a word or statement negative", "不；没有"),
    "no": ("not any; a negative answer", "没有；不；否"), "yes": ("an affirmative answer", "是；好的"),
    "but": ("used to introduce a contrast", "但是；不过"), "or": ("used to show an alternative", "或者；还是"),
    "if": ("on the condition that; whether", "如果；是否"), "because": ("for the reason that", "因为"),
    "than": ("used in a comparison", "比；用于比较"), "so": ("therefore; to such a degree", "所以；如此"),
    "all": ("the whole number or amount", "全部；所有"), "some": ("an unspecified amount or number", "一些；某些"),
    "any": ("one or more, without specifying which", "任何；一些"), "both": ("the two together", "两者都"),
    "every": ("each member of a group", "每一个"), "more": ("a greater amount or number", "更多"),
    "most": ("the greatest amount or number", "最多；大多数"), "much": ("a large amount", "许多；很大程度"),
    "only": ("and no others; no more than", "只有；仅仅"), "very": ("to a high degree; exact", "非常；正是"),
    "also": ("in addition; too", "也；还"), "just": ("exactly; only; a short time ago", "正好；只是；刚刚"),
    "about": ("concerning; approximately", "关于；大约"), "up": ("toward a higher place or level", "向上；提高"),
    "down": ("toward a lower place or level", "向下；降低"), "out": ("away from the inside", "出去；在外"),
    "there": ("in or at that place; used to introduce existence", "在那里；用于表示存在"), "here": ("in or at this place", "在这里"),
    "now": ("at the present time", "现在"), "then": ("at that time; next", "那时；然后"),
    "first": ("before all others; number one", "第一；首先"), "one": ("the number 1; a single person or thing", "一；一个"),
    "two": ("the number 2", "二；两个"), "three": ("the number 3", "三；三个"),
    "something": ("an unspecified thing", "某事；某物"), "anything": ("any thing at all", "任何事物"),
    "everything": ("all things", "一切；所有事物"), "s": ("the letter s; a common plural or verb ending", "字母 S；常见复数或动词词尾"),
    "mr": ("a title used before a man's name", "先生"),
    "it's": ("it is; it has", "it is 或 it has 的缩写"), "i'm": ("I am", "I am 的缩写"),
    "you're": ("you are", "you are 的缩写"), "he's": ("he is; he has", "he is 或 he has 的缩写"),
    "that's": ("that is; that has", "that is 或 that has 的缩写"), "there's": ("there is; there has", "there is 或 there has 的缩写"),
    "i've": ("I have", "I have 的缩写"), "don't": ("do not", "do not 的缩写；不"),
    "doesn't": ("does not", "does not 的缩写；不"), "didn't": ("did not", "did not 的缩写；没有"),
    "can't": ("cannot", "不能；不可以"),
}
ENGLISH_CORE_GLOSSES.update({
    "like": ("to enjoy or prefer", "喜欢；想要"), "time": ("a measured period; an occasion", "时间；次数"),
    "get": ("to obtain; to become", "得到；获得；变得"), "new": ("recently made or discovered", "新的；新近的"),
    "people": ("human beings as a group", "人们；人民"), "other": ("different or additional", "其他的；另一个"),
    "good": ("positive, suitable, or of high quality", "好的；合适的；优良的"), "know": ("to have information or understanding", "知道；了解；认识"),
    "see": ("to perceive with the eyes; to understand", "看见；看到；明白"), "make": ("to create, produce, or cause", "制作；使得；做"),
    "over": ("above; across; finished", "在……上方；越过；结束"), "think": ("to use the mind; to believe", "思考；认为；想"),
    "back": ("the rear; toward an earlier place or state", "后面；返回"), "want": ("to desire or need", "想要；需要"),
    "go": ("to move or travel", "去；走；进行"), "well": ("in a good or satisfactory way", "好地；顺利地；健康的"),
    "said": ("past form of say", "说了；say 的过去式"), "way": ("a method, direction, or manner", "方法；道路；方式"),
    "even": ("used to emphasize something unexpected; level", "甚至；即使；平坦的"), "need": ("to require something", "需要；必须"),
    "really": ("truly; in fact; very", "真正地；事实上；很"), "right": ("correct; the direction opposite left", "正确的；右边；权利"),
    "work": ("effort or a job; to function", "工作；劳动；运转"), "year": ("a period of about 365 days", "年；一年"),
    "years": ("more than one year; a long period", "多年；岁月"), "being": ("existing; a living thing", "存在；生物；be 的现在分词"),
    "day": ("a 24-hour period; daytime", "一天；白天"), "too": ("also; more than is wanted", "也；太；过于"),
    "going": ("moving or leaving; planned to", "前往；离开；将要"), "off": ("away from; not operating", "离开；关闭；脱离"),
    "still": ("continuing until now; not moving", "仍然；静止的"), "take": ("to carry, receive, or use", "拿；带；花费；乘坐"),
    "got": ("past form of get", "得到；变得；get 的过去式"), "many": ("a large number of", "许多；很多"),
    "never": ("not at any time", "从不；永不"), "life": ("the state or period of being alive", "生命；生活；一生"),
    "say": ("to speak or express in words", "说；讲；表示"), "world": ("Earth and all its people; a sphere of activity", "世界；地球；领域"),
    "great": ("very good, important, or large", "很好的；伟大的；巨大的"), "last": ("final; most recent; to continue", "最后的；最近的；持续"),
    "while": ("a period of time; during the time that", "一会儿；当……时"), "best": ("better than all others", "最好的；最佳"),
    "such": ("of this or that kind", "这样的；如此的"), "love": ("deep affection; to care for greatly", "爱；热爱"),
    "man": ("an adult male person; a human being", "男人；人"), "home": ("the place where someone lives", "家；住所；在家"),
    "long": ("having a great length or duration", "长的；长久的"), "look": ("to direct the eyes; an appearance", "看；看起来；外表"),
    "use": ("to employ for a purpose", "使用；用途"), "used": ("employed for a purpose; accustomed to", "使用过的；习惯于"),
    "same": ("not different; identical", "相同的；同样的"), "come": ("to move toward a place or person", "来；来到"),
    "part": ("a piece or portion of a whole", "部分；零件；角色"), "state": ("a condition; a political region; to express", "状态；州；陈述"),
    "always": ("at all times", "总是；一直"), "better": ("more good; improved", "更好的；改善的"),
    "find": ("to discover or locate", "找到；发现"), "help": ("to assist; assistance", "帮助；协助"),
    "high": ("far above the ground or a normal level", "高的；高水平的"), "little": ("small in size or amount", "小的；少量的"),
    "old": ("having existed or lived for a long time", "老的；旧的"), "another": ("one more; a different one", "另一个；又一个"),
    "things": ("objects, matters, or situations", "事物；事情；物品"), "game": ("an activity or contest with rules", "游戏；比赛"),
    "thing": ("an object, matter, or situation", "东西；事情；事物"), "give": ("to hand, provide, or cause", "给；提供；使得"),
    "house": ("a building where people live", "房子；住宅"),
})


def lexical_form(value: str) -> bool:
    value = unicodedata.normalize("NFKC", value).strip()
    if not value or len(value) > 48 or any(ch.isdigit() for ch in value):
        return False
    letters = sum(unicodedata.category(ch).startswith("L") for ch in value)
    if not letters:
        return False
    return all(unicodedata.category(ch).startswith(("L", "M", "Z")) or ch in "-'’" for ch in value)


def candidate_ranks(language: str, limit: int = 25000) -> dict[str, int]:
    ranked: dict[str, int] = {}
    for value in top_n_list(language, limit, wordlist="best"):
        word = unicodedata.normalize("NFKC", value).strip()
        key = word.casefold()
        if lexical_form(word) and key not in ranked:
            ranked[key] = len(ranked) + 1
    return ranked


def clean_gloss(entry: dict) -> str:
    for sense in entry.get("senses") or []:
        tags = set(sense.get("tags") or [])
        if tags & DISALLOWED_TAGS or sense.get("form_of") or sense.get("alt_of"):
            continue
        for gloss in sense.get("glosses") or []:
            value = re.sub(r"\s+", " ", str(gloss)).strip()
            value = re.sub(r"\s*\([^)]*(?:obsolete|archaic|historical)[^)]*\)\s*", " ", value, flags=re.I).strip()
            if 1 <= len(value) <= 180:
                return value
    return ""


def learner_ready_gloss(value: str) -> bool:
    return not re.match(
        r"^(?:feminine|masculine|plural|singular|comparative|superlative|past|present|inflection|conjugation|alternative (?:form|spelling)) of\b",
        value.strip(), flags=re.I,
    )


def dictionary_ipa(entry: dict) -> str:
    values = [str(sound.get("ipa") or "").strip() for sound in entry.get("sounds") or []]
    values = [value for value in values if value and len(value) <= 120 and not value.startswith("-")]
    preferred = next((value for value in values if value.startswith("/") and value.endswith("/")), "")
    return preferred or (values[0] if values else "")


def extract(language: str, output: Path) -> None:
    ranks = candidate_ranks(language)
    selected: dict[str, dict] = {}
    for line_number, line in enumerate(sys.stdin, 1):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("lang_code") != language:
            continue
        word = unicodedata.normalize("NFKC", str(entry.get("word") or "")).strip()
        key = word.casefold()
        if key not in ranks or not lexical_form(word) or entry.get("pos") not in ALLOWED_POS:
            continue
        gloss = clean_gloss(entry)
        if not gloss:
            continue
        record = {
            "rank": ranks[key], "form": word, "pos": entry.get("pos"), "meaning_en": gloss,
            "ipa": dictionary_ipa(entry), "entry_id": next((sense.get("id") for sense in entry.get("senses") or [] if sense.get("id")), ""),
        }
        current = selected.get(key)
        if current is None or (not current["ipa"] and record["ipa"]):
            selected[key] = record
        if line_number % 500000 == 0:
            print(f"{language}: scanned {line_number:,}, matched {len(selected):,}", file=sys.stderr)
    records = sorted(selected.values(), key=lambda item: (item["rank"], item["form"]))
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{language}: retained {len(records):,} dictionary-backed frequency candidates", file=sys.stderr)
    if len(records) < 4200:
        raise SystemExit(f"{language}: only {len(records)} usable candidates; at least 4200 are required")


def extract_oewn(output: Path) -> None:
    """Extract the most frequent everyday English sense.

    The command name is retained for release-script compatibility. Princeton
    WordNet's SemCor lemma counts rank common senses; OMW supplies concise
    Chinese lemmas where available. Closed-class words use the curated table
    above because WordNet intentionally omits many grammatical meanings.
    """
    from nltk.corpus import wordnet
    records: list[dict] = []
    for word, rank in candidate_ranks("en").items():
        core = ENGLISH_CORE_GLOSSES.get(word.casefold())
        if core:
            records.append({"rank": rank, "form": word, "pos": "function", "meaning_en": core[0],
                            "meaning_zh": core[1], "ipa": "", "entry_id": "curated-core", "source": "wordnet30+curated"})
            continue
        bases = {word.casefold()}
        for pos in (wordnet.NOUN, wordnet.VERB, wordnet.ADJ, wordnet.ADV):
            base = wordnet.morphy(word, pos)
            if base:
                bases.add(base.casefold())
        ranked_synsets: list[tuple[int, int, object]] = []
        for index, synset in enumerate(wordnet.synsets(word)):
            counts = [lemma.count() for lemma in synset.lemmas() if lemma.name().replace("_", " ").casefold() in bases]
            ranked_synsets.append((max(counts, default=-1), -index, synset))
        if not ranked_synsets:
            continue
        count, _, synset = max(ranked_synsets, key=lambda item: (item[0], item[1]))
        definition = re.sub(r"\s+", " ", synset.definition()).strip()
        if count < 0 or not definition or not learner_ready_gloss(definition):
            continue
        chinese: list[str] = []
        for lemma in synset.lemma_names("cmn"):
            value = lemma.replace("_", " ").strip()
            if value and value not in chinese:
                chinese.append(value)
        records.append({"rank": rank, "form": word, "pos": synset.pos(), "meaning_en": definition,
                        "meaning_zh": "；".join(chinese[:3]), "ipa": "", "entry_id": synset.name(),
                        "sense_count": count, "source": "wordnet30+omw"})
    records.sort(key=lambda item: (item["rank"], item["form"]))
    output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"en: retained {len(records):,} corpus-ranked Princeton WordNet candidates", file=sys.stderr)
    if len(records) < 4200:
        raise SystemExit(f"en: only {len(records)} usable WordNet candidates; at least 4200 are required")


def sql_unquote(value: str) -> str:
    value = value.strip()
    return value[1:-1].replace("''", "'") if value.startswith("'") and value.endswith("'") else value


def sql_quote(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def existing_forms(migration: Path, language: str) -> set[str]:
    forms: set[str] = set()
    for line in migration.read_text(encoding="utf-8").splitlines():
        if not line.startswith("INSERT INTO smartlingo_vocabulary_items"):
            continue
        raw = line.split("VALUES(", 1)[1].rsplit(");", 1)[0]
        fields = next(csv.reader([raw], delimiter=",", quotechar="'", doublequote=True, skipinitialspace=True))
        if len(fields) >= 19 and sql_unquote(fields[3]) == language:
            forms.add(sql_unquote(fields[9]).casefold())
    if len(forms) != 28:
        raise SystemExit(f"{language}: expected 28 starter forms, found {len(forms)}")
    return forms


def starter_phonetics(migration: Path, language: str) -> list[tuple[str, str, str, str]]:
    pattern = re.compile(
        r"target_phonetic='((?:''|[^'])*)', pronunciation_en='((?:''|[^'])*)', "
        r"pronunciation_zh='((?:''|[^'])*)'.*WHERE id='(vocab_" + re.escape(language) + r"_[^']+)'"
    )
    rows = [(item_id, ipa.replace("''", "'"), en.replace("''", "'"), zh.replace("''", "'"))
            for ipa, en, zh, item_id in pattern.findall(migration.read_text(encoding="utf-8"))]
    if len(rows) != 28:
        raise SystemExit(f"{language}: expected 28 starter phonetics, found {len(rows)}")
    return rows


LATIN_PHONE_MAP = (
    ("tʃ", "ch"), ("dʒ", "j"), ("tɕ", "ch"), ("dʑ", "j"), ("ts", "ts"), ("d̪", "d"), ("t̪", "t"),
    ("ɲ", "ny"), ("ŋ", "ng"), ("ʃ", "sh"), ("ʒ", "zh"), ("ɕ", "sh"), ("ʂ", "sh"), ("ʐ", "zh"),
    ("θ", "th"), ("ð", "th"), ("ɣ", "gh"), ("x", "kh"), ("ç", "hy"), ("χ", "kh"), ("ʁ", "r"),
    ("ɾ", "r"), ("ɹ", "r"), ("ɻ", "r"), ("ɰ", "w"), ("ʋ", "v"), ("ɦ", "h"), ("ʔ", ""),
    ("i", "ee"), ("ɪ", "i"), ("e", "ay"), ("ɛ", "e"), ("æ", "a"), ("a", "ah"), ("ɑ", "ah"),
    ("ɐ", "uh"), ("ə", "uh"), ("ʌ", "uh"), ("ɜ", "ur"), ("ɚ", "ur"), ("ɝ", "ur"),
    ("u", "oo"), ("ʊ", "u"), ("o", "oh"), ("ɔ", "aw"), ("ɒ", "o"), ("ø", "eu"), ("œ", "eu"),
    ("y", "ue"), ("ɨ", "i"), ("ɯ", "eu"), ("ɤ", "uh"), ("ɘ", "uh"), ("̃", "n"), ("ː", ""),
)
SCRIPT_PHONE_MAPS = {
    "ja": (("tʃ", "チ"), ("dʒ", "ジ"), ("tɕ", "チ"), ("dʑ", "ジ"), ("ʃ", "シ"), ("ʒ", "ジ"), ("θ", "ス"), ("ð", "ズ"), ("ŋ", "ン"), ("ɲ", "ニ"), ("p", "プ"), ("b", "ブ"), ("t", "ト"), ("d", "ド"), ("k", "ク"), ("g", "グ"), ("m", "ム"), ("n", "ン"), ("f", "フ"), ("v", "ヴ"), ("s", "ス"), ("z", "ズ"), ("h", "ハ"), ("r", "ル"), ("l", "ル"), ("j", "イ"), ("w", "ウ"), ("i", "イ"), ("e", "エ"), ("a", "ア"), ("ə", "ア"), ("u", "ウ"), ("o", "オ")),
    "ko": (("tʃ", "치"), ("dʒ", "지"), ("tɕ", "치"), ("dʑ", "지"), ("ʃ", "시"), ("ʒ", "지"), ("θ", "스"), ("ð", "드"), ("ŋ", "응"), ("ɲ", "니"), ("p", "프"), ("b", "브"), ("t", "트"), ("d", "드"), ("k", "크"), ("g", "그"), ("m", "므"), ("n", "느"), ("f", "프"), ("v", "브"), ("s", "스"), ("z", "즈"), ("h", "흐"), ("r", "르"), ("l", "르"), ("j", "이"), ("w", "우"), ("i", "이"), ("e", "에"), ("a", "아"), ("ə", "어"), ("u", "우"), ("o", "오")),
    "ru": (("tʃ", "ч"), ("dʒ", "дж"), ("ʃ", "ш"), ("ʒ", "ж"), ("θ", "с"), ("ð", "з"), ("ŋ", "нг"), ("ɲ", "нь"), ("j", "й"), ("w", "у"), ("ə", "а"), ("ɐ", "а"), ("ɑ", "а"), ("æ", "э"), ("ɛ", "э"), ("ɪ", "и"), ("ɨ", "ы"), ("ʊ", "у"), ("ɔ", "о"), ("ʁ", "р"), ("ɾ", "р"), ("ɹ", "р")),
    "ar": (("tʃ", "تش"), ("dʒ", "ج"), ("ʃ", "ش"), ("ʒ", "ج"), ("θ", "ث"), ("ð", "ذ"), ("ŋ", "نغ"), ("ɲ", "ني"), ("p", "ب"), ("b", "ب"), ("t", "ت"), ("d", "د"), ("k", "ك"), ("g", "غ"), ("m", "م"), ("n", "ن"), ("f", "ف"), ("v", "ف"), ("s", "س"), ("z", "ز"), ("h", "ه"), ("r", "ر"), ("l", "ل"), ("j", "ي"), ("w", "و"), ("i", "ي"), ("e", "ي"), ("a", "ا"), ("ə", "ا"), ("u", "و"), ("o", "و")),
    "hi": (("tʃ", "च"), ("dʒ", "ज"), ("ʃ", "श"), ("ʒ", "ज़"), ("θ", "थ"), ("ð", "द"), ("ŋ", "ङ"), ("ɲ", "ञ"), ("p", "प"), ("b", "ब"), ("t", "त"), ("d", "द"), ("k", "क"), ("g", "ग"), ("m", "म"), ("n", "न"), ("f", "फ़"), ("v", "व"), ("s", "स"), ("z", "ज़"), ("h", "ह"), ("r", "र"), ("l", "ल"), ("j", "य"), ("w", "व"), ("i", "ई"), ("e", "ए"), ("a", "आ"), ("ə", "अ"), ("u", "ऊ"), ("o", "ओ")),
}
SCRIPT_PHONE_EXTRAS = {
    "ja": (("ɾ", "ル"), ("ɹ", "ル"), ("ʁ", "ル"), ("ɻ", "ル"), ("x", "ハ"), ("ɣ", "ガ"), ("ç", "ヒ"), ("ɦ", "ハ"), ("ʔ", ""), ("q", "ク"), ("c", "ク"), ("ɪ", "イ"), ("ɛ", "エ"), ("æ", "ア"), ("ɑ", "ア"), ("ɐ", "ア"), ("ʌ", "ア"), ("ɜ", "ア"), ("ɘ", "ア"), ("ɞ", "オ"), ("ɵ", "オ"), ("ɨ", "イ"), ("ɯ", "ウ"), ("ɤ", "オ"), ("ʊ", "ウ"), ("ɔ", "オ"), ("ɒ", "オ"), ("ø", "ウ"), ("œ", "ウ"), ("y", "ユ"), ("̃", "ン")),
    "ko": (("ɾ", "르"), ("ɹ", "르"), ("ʁ", "르"), ("ɻ", "르"), ("x", "흐"), ("ɣ", "그"), ("ç", "히"), ("ɦ", "흐"), ("ʔ", ""), ("q", "크"), ("c", "크"), ("ɪ", "이"), ("ɛ", "에"), ("æ", "애"), ("ɑ", "아"), ("ɐ", "아"), ("ʌ", "어"), ("ɜ", "어"), ("ɘ", "어"), ("ɞ", "오"), ("ɵ", "오"), ("ɨ", "으"), ("ɯ", "으"), ("ɤ", "어"), ("ʊ", "우"), ("ɔ", "오"), ("ɒ", "오"), ("ø", "외"), ("œ", "외"), ("y", "위"), ("̃", "응")),
    "ru": (("p", "п"), ("b", "б"), ("t", "т"), ("d", "д"), ("k", "к"), ("g", "г"), ("q", "к"), ("c", "к"), ("m", "м"), ("n", "н"), ("f", "ф"), ("v", "в"), ("s", "с"), ("z", "з"), ("h", "х"), ("r", "р"), ("l", "л"), ("x", "х"), ("ɣ", "г"), ("ʔ", ""), ("i", "и"), ("e", "э"), ("a", "а"), ("u", "у"), ("o", "о"), ("ʌ", "а"), ("ɜ", "ё"), ("ɘ", "э"), ("ɞ", "о"), ("ɵ", "о"), ("ɯ", "ы"), ("ɤ", "ы"), ("ø", "ё"), ("œ", "ё"), ("y", "ю"), ("̃", "н")),
    "ar": (("ɾ", "ر"), ("ɹ", "ر"), ("ʁ", "ر"), ("x", "خ"), ("ɣ", "غ"), ("ç", "ه"), ("ɦ", "ه"), ("ʔ", "ء"), ("q", "ق"), ("c", "ك"), ("ɪ", "ي"), ("ɛ", "ي"), ("æ", "ا"), ("ɑ", "ا"), ("ɐ", "ا"), ("ʌ", "ا"), ("ɜ", "ا"), ("ɘ", "ا"), ("ɞ", "و"), ("ɵ", "و"), ("ɨ", "ي"), ("ɯ", "و"), ("ɤ", "ا"), ("ʊ", "و"), ("ɔ", "و"), ("ɒ", "و"), ("ø", "و"), ("œ", "و"), ("y", "ي"), ("̃", "ن")),
    "hi": (("ɾ", "र"), ("ɹ", "र"), ("ʁ", "र"), ("x", "ख"), ("ɣ", "ग"), ("ç", "ह"), ("ɦ", "ह"), ("ʔ", ""), ("q", "क"), ("c", "क"), ("ɪ", "इ"), ("ɛ", "ए"), ("æ", "ऐ"), ("ɑ", "आ"), ("ɐ", "अ"), ("ʌ", "अ"), ("ɜ", "अ"), ("ɘ", "अ"), ("ɞ", "ओ"), ("ɵ", "ओ"), ("ɨ", "इ"), ("ɯ", "उ"), ("ɤ", "अ"), ("ʊ", "उ"), ("ɔ", "ओ"), ("ɒ", "ऑ"), ("ø", "ओ"), ("œ", "ओ"), ("y", "यू"), ("̃", "ं")),
}


def compact_ipa(ipa: str) -> str:
    decomposed = unicodedata.normalize("NFD", ipa)
    return re.sub(r"[\[\]/ˈˌ.‿͜͡ːˑ̩̯ˤʲʰʱʷʴ̥̬⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁽⁾0-9]", "", decomposed).strip()


def replace_phones(value: str, replacements: tuple[tuple[str, str], ...]) -> str:
    mapping = dict(replacements)
    pattern = re.compile("|".join(re.escape(source) for source in sorted(mapping, key=len, reverse=True)))
    value = pattern.sub(lambda match: mapping[match.group(0)], value)
    return re.sub(r"\s+", " ", value).strip(" -")


def pronunciation_guides(ipa: str) -> dict[str, str]:
    source = compact_ipa(ipa)
    latin = replace_phones(source, LATIN_PHONE_MAP)
    latin = re.sub(r"[^\w\- ']+", "", latin, flags=re.UNICODE).strip() or source
    guides = {code: latin for code in ("zh", "en", "es", "fr", "de", "it", "pt")}
    for code, mapping in SCRIPT_PHONE_MAPS.items():
        rendered = replace_phones(source, mapping + SCRIPT_PHONE_EXTRAS[code])
        rendered = replace_phones(rendered, LATIN_PHONE_MAP)
        rendered = re.sub(r"[ˤʲʰʱʷʴ̥̬̃]+", "", rendered).strip() or latin
        guides[code] = rendered
    return {code: guides.get(code, latin) for code in LANGUAGES}


def translate_glosses(records: list[dict]) -> None:
    pending = list(dict.fromkeys(record["meaning_en"] for record in records if not record.get("meaning_zh")))
    if not pending:
        return
    import ctranslate2
    from argostranslate import translate
    languages = translate.get_installed_languages()
    source_language = next(item for item in languages if item.code == "en")
    target_language = next(item for item in languages if item.code == "zh")
    translation = source_language.get_translation(target_language)
    while hasattr(translation, "underlying"):
        translation = translation.underlying
    package = translation.pkg
    translator = ctranslate2.Translator(str(package.package_path / "model"), device="cpu", inter_threads=1, intra_threads=4)
    cache: dict[str, str] = {}
    for start in range(0, len(pending), 256):
        batch = pending[start:start + 256]
        tokenized = [package.tokenizer.encode(value) for value in batch]
        target_prefix = [[package.target_prefix]] * len(tokenized) if package.target_prefix else None
        translated = translator.translate_batch(tokenized, target_prefix=target_prefix, replace_unknowns=True,
                                                max_batch_size=256, batch_type="examples", beam_size=1,
                                                num_hypotheses=1, return_scores=False)
        for original, result in zip(batch, translated):
            value = package.tokenizer.decode(result.hypotheses[0]).strip()
            if package.target_prefix and value.startswith(package.target_prefix):
                value = value[len(package.target_prefix):].strip()
            value = re.sub(r"(.)\1{5,}", r"\1", value)
            value = re.sub(r"(.{2,12})\1{3,}", r"\1", value)
            value = re.sub(r"\s+", " ", value).strip(" ;；,，")
            if len(value) > 90:
                clauses = [part.strip() for part in re.split(r"[。；;]", value) if part.strip()]
                value = next((part for part in clauses if 2 <= len(part) <= 90), value[:88] + "…")
            cache[original] = value or original
        print(f"translated {min(start + len(batch), len(pending)):,}/{len(pending):,}", file=sys.stderr)
    for record in records:
        if not record.get("meaning_zh"):
            record["meaning_zh"] = cache.get(record["meaning_en"], record["meaning_en"])


def fill_missing_ipa(records: list[dict], language: str) -> None:
    missing = [record for record in records if not record["ipa"]]
    if not missing:
        return
    from phonemizer import phonemize
    values = phonemize([record["form"] for record in missing], language=ESPEAK_VOICES[language], backend="espeak", strip=True, njobs=1)
    for record, value in zip(missing, values):
        record["ipa"] = f"/{value.strip()}/"


def render_language(language: str, source: Path, starter_migration: Path, pronunciation_migration: Path, output: Path) -> None:
    records = json.loads(source.read_text(encoding="utf-8"))
    starters = existing_forms(starter_migration, language)
    chosen = [record for record in records if record["form"].casefold() not in starters and learner_ready_gloss(record["meaning_en"])][:3972]
    if len(chosen) != 3972:
        raise SystemExit(f"{language}: only {len(chosen)} non-starter records; 3972 required")
    fill_missing_ipa(chosen, language)
    if any(not record["ipa"].strip("/ ") for record in chosen):
        raise SystemExit(f"{language}: IPA generation left empty records")
    translate_glosses(chosen)
    enriched = {record["form"].casefold(): record for record in chosen}
    for record in records:
        if record["form"].casefold() in enriched:
            record.update(enriched[record["form"].casefold()])
    source.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    language_name = LANGUAGE_NAMES[language]
    lexical_comment = "Princeton WordNet 3.0 corpus-ranked senses + OMW Chinese lemmas; IPA from eSpeak NG." if language == "en" else "English Wiktionary/Kaikki senses (CC BY-SA 4.0); missing IPA from eSpeak NG."
    lines = [
        f"-- SmartLingo {language_name} frequency catalog v2026.08.20.",
        f"-- wordfreq corpus rank + {lexical_comment}",
    ]
    for item_id, ipa, guide_en, guide_zh in starter_phonetics(pronunciation_migration, language):
        guides = pronunciation_guides(ipa)
        guides["en"] = guide_en
        guides["zh"] = guide_zh
        lines.append("UPDATE smartlingo_vocabulary_items SET pronunciation_guides=" +
                     sql_quote(json.dumps(guides, ensure_ascii=False, separators=(",", ":"))) +
                     ", pronunciation_guide_version='sl-guide-v1', review_method='existing-reviewed-catalog' WHERE id=" + sql_quote(item_id) + ";")
    for offset, record in enumerate(chosen, 29):
        level = "beginner" if offset <= 1000 else "intermediate" if offset <= 2500 else "advanced"
        cefr = "A1-aligned" if level == "beginner" else "A2-B1-aligned" if level == "intermediate" else "B1+-B2-aligned"
        difficulty = 1 if offset <= 500 else 2 if offset <= 1000 else 3 if offset <= 2500 else 4 if offset <= 3500 else 5
        productive = 1 if offset <= 700 or 1001 <= offset <= 1800 or 2501 <= offset <= 3000 else 0
        scene = SCENES[((offset - 1) // 334) % len(SCENES)]
        stable_key = f"{language}.{level}.frequency.{offset}"
        item_id = f"vocab_{language}_{level}_frequency_{offset}_v1"
        guides = json.dumps(pronunciation_guides(record["ipa"]), ensure_ascii=False, separators=(",", ":"))
        english_source = str(record.get("source") or "").startswith("wordnet30")
        source_url = "https://wordnet.princeton.edu/" if english_source else f"https://kaikki.org/dictionary/{language_name}/"
        source_license = "WordNet 3.0 license; OMW 1.4 data license" if english_source else "CC BY-SA 4.0"
        source_revision = "Princeton WordNet 3.0 + OMW 1.4; retrieved 2026-08-20" if english_source else "English Wiktionary dump 2026-08-05; retrieved 2026-08-20"
        review_method = "wordfreq-rank+wordnet-lemma-frequency+omw-or-curated-gloss+automated-linguistic-validation" if english_source else "wordfreq-rank+wiktionary-sense+automated-linguistic-validation"
        item_kind = "phrase" if any(character.isspace() for character in record["form"]) else "word"
        values = [item_id, stable_key, "1", language, level, cefr, difficulty, scene, offset, record["form"], record["ipa"],
                  record["meaning_en"], record["meaning_zh"], item_kind, productive, "smartlingo_original", "published",
                  record["ipa"], pronunciation_guides(record["ipa"])["en"], pronunciation_guides(record["ipa"])["zh"], guides,
                  "sl-guide-v1", source_url, source_license, source_revision, review_method]
        quoted = [sql_quote(value) for value in values]
        quoted[6] = str(difficulty); quoted[8] = str(offset); quoted[14] = str(productive)
        lines.append("INSERT INTO smartlingo_vocabulary_items "
          "(id,stable_key,version,target_language,level,cefr_band,difficulty,scene_key,sequence,form,pronunciation,meaning_en,meaning_zh,item_kind,productive,source_type,review_status,target_phonetic,pronunciation_en,pronunciation_zh,pronunciation_guides,pronunciation_guide_version,lexical_source_url,lexical_source_license,lexical_source_revision,review_method,created_at,updated_at) VALUES(" + ",".join(quoted) + ",unixepoch(),unixepoch());")
    lines.extend([
        # Cloudflare D1 rejects TEMP schema writes during remote migrations.
        # A short-lived ordinary table keeps the same fail-closed assertion.
        "CREATE TABLE smartlingo_vocab_release_check(value INTEGER CHECK(value=1));",
        f"INSERT INTO smartlingo_vocab_release_check SELECT COUNT(*)=4000 FROM smartlingo_vocabulary_items WHERE target_language={sql_quote(language)} AND review_status='published';",
        f"INSERT INTO smartlingo_vocab_release_check SELECT COUNT(*)=1000 FROM smartlingo_vocabulary_items WHERE target_language={sql_quote(language)} AND level='beginner' AND review_status='published';",
        f"INSERT INTO smartlingo_vocab_release_check SELECT COUNT(*)=1500 FROM smartlingo_vocabulary_items WHERE target_language={sql_quote(language)} AND level='intermediate' AND review_status='published';",
        f"INSERT INTO smartlingo_vocab_release_check SELECT COUNT(*)=1500 FROM smartlingo_vocabulary_items WHERE target_language={sql_quote(language)} AND level='advanced' AND review_status='published';",
        "DROP TABLE smartlingo_vocab_release_check;",
    ])
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{language}: rendered {output} with 3972 additions", file=sys.stderr)


def render_english_gloss_correction(source: Path, starter_migration: Path, output: Path) -> None:
    records = json.loads(source.read_text(encoding="utf-8"))
    starters = existing_forms(starter_migration, "en")
    # The first production catalog and the corrected fresh-install catalog do
    # not contain exactly the same 3,972 forms. Both draw from ranks <= 5,014,
    # so updating the bounded rank-5,100 union by actual form safely covers
    # both without coupling meanings to an old sequence ID.
    chosen = [record for record in records if record["rank"] <= 5100 and record["form"].casefold() not in starters and learner_ready_gloss(record["meaning_en"])]
    translate_glosses(chosen)
    if len(chosen) < 3972 or any(not str(record.get("meaning_zh") or "").strip() for record in chosen):
        raise SystemExit("English correction requires a complete bilingual rank-5,100 union")
    lines = [
        "-- Correct English frequency items to the corpus-most-common sense.",
        "-- Princeton WordNet lemma counts + OMW Chinese lemmas + curated closed-class glosses.",
    ]
    for record in chosen:
        lines.append(
            "UPDATE smartlingo_vocabulary_items SET meaning_en=" + sql_quote(record["meaning_en"]) +
            ", meaning_zh=" + sql_quote(record["meaning_zh"]) +
            ", lexical_source_url='https://wordnet.princeton.edu/'" +
            ", lexical_source_license='WordNet 3.0 license; OMW 1.4 data license'" +
            ", lexical_source_revision='Princeton WordNet 3.0 + OMW 1.4; retrieved 2026-08-20'" +
            ", review_method='wordfreq-rank+wordnet-lemma-frequency+omw-or-curated-gloss+automated-linguistic-validation'" +
            ", updated_at=unixepoch() WHERE target_language='en' AND lower(form)=" + sql_quote(record["form"].casefold()) + ";"
        )
    lines.extend([
        "CREATE TABLE smartlingo_english_gloss_check(value INTEGER CHECK(value=1));",
        "INSERT INTO smartlingo_english_gloss_check SELECT COUNT(*)=4000 FROM smartlingo_vocabulary_items WHERE target_language='en' AND review_status='published';",
        "INSERT INTO smartlingo_english_gloss_check SELECT COUNT(*)=1 FROM smartlingo_vocabulary_items WHERE form='in' AND target_language='en' AND meaning_zh='在……里面；在……期间';",
        "INSERT INTO smartlingo_english_gloss_check SELECT COUNT(*)=1 FROM smartlingo_vocabulary_items WHERE form='be' AND target_language='en' AND meaning_zh='是；存在；成为';",
        "INSERT INTO smartlingo_english_gloss_check SELECT COUNT(*)=1 FROM smartlingo_vocabulary_items WHERE form='day' AND target_language='en' AND meaning_zh='一天；白天';",
        "DROP TABLE smartlingo_english_gloss_check;",
    ])
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"en: rendered {output} with {len(chosen)} common-sense corrections", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    extract_parser = subparsers.add_parser("extract")
    extract_parser.add_argument("--lang", choices=LANGUAGES, required=True)
    extract_parser.add_argument("--out", type=Path, required=True)
    oewn_parser = subparsers.add_parser("extract-oewn")
    oewn_parser.add_argument("--out", type=Path, required=True)
    render_parser = subparsers.add_parser("render")
    render_parser.add_argument("--lang", choices=LANGUAGES, required=True)
    render_parser.add_argument("--source", type=Path, required=True)
    render_parser.add_argument("--starter-migration", type=Path, required=True)
    render_parser.add_argument("--pronunciation-migration", type=Path, required=True)
    render_parser.add_argument("--out", type=Path, required=True)
    correction_parser = subparsers.add_parser("render-english-correction")
    correction_parser.add_argument("--source", type=Path, required=True)
    correction_parser.add_argument("--starter-migration", type=Path, required=True)
    correction_parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "extract":
        extract(args.lang, args.out)
    elif args.command == "extract-oewn":
        extract_oewn(args.out)
    elif args.command == "render":
        render_language(args.lang, args.source, args.starter_migration, args.pronunciation_migration, args.out)
    elif args.command == "render-english-correction":
        render_english_gloss_correction(args.source, args.starter_migration, args.out)


if __name__ == "__main__":
    main()
