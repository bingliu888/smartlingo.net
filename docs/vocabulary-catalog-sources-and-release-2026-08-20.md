# SmartLingo vocabulary catalog sources and release method

## Published scope

Each of the twelve target languages (`zh`, `en`, `es`, `ja`, `ko`, `fr`, `de`, `ru`, `it`, `pt`, `ar`, `hi`) has one cumulative course catalog:

- Beginner: 1,000 published items
- Intermediate: 2,500 cumulative items (1,500 new)
- Advanced: 4,000 cumulative items (1,500 new)

The numerical targets are SmartLingo curriculum targets. They are aligned to CEFR communicative descriptors; they are not presented as an official Council of Europe word list.

## Reproducible sources

- Curriculum goals and scene coverage: Council of Europe CEFR descriptors.
- Frequency ordering: `wordfreq` corpus frequencies (CC BY-SA 4.0 data; Apache-2.0 software).
- English lexical senses: Princeton WordNet 3.0, ranked with its corpus lemma counts under the WordNet 3.0 license. Open Multilingual Wordnet 1.4 supplies concise Chinese lemmas when present; an explicit tested core map covers grammatical words WordNet intentionally omits.
- Other-language lexical senses and dictionary IPA: English Wiktionary dump dated 2026-08-05, extracted by Wiktextract/Kaikki (CC BY-SA 4.0; retrieved 2026-08-20).
- Missing IPA fallback: eSpeak NG linguistic rules. The stored output is release data; eSpeak is not a production dependency.
- Chinese gloss draft: Argos Translate English-to-Chinese offline model when no OMW or explicit core gloss is available. Automated length and repetition gates run before release; this field is never represented as human translated.

Every generated row records the lexical source URL, license, source revision, and review method. Existing 336 SmartLingo starter rows retain their reviewed-catalog provenance.

The legacy `source_type=smartlingo_original` column identifies the SmartLingo editorial record namespace; it is not used as a claim that an upstream dictionary sense was invented by SmartLingo. The four explicit lexical-source fields are authoritative for attribution.

## Pronunciation contract

`target_phonetic` is the language-neutral pronunciation authority. `pronunciation_guides` is a JSON object with all twelve supported language keys. These values are intentionally labelled approximate reading aids in the interface and never replace target-language audio or speech recognition.

Speech recognition always uses the target-language locale. The learner's interface language only selects the explanation and reading aid; it must never change the recognition locale.

## Release gates

The builder and migrations reject a release unless:

1. every target language has exactly 1,000 Beginner, 1,500 Intermediate, and 1,500 Advanced rows;
2. every published row has non-empty target IPA and all twelve reading-aid keys;
3. stable keys are unique and every row has source/license/revision/review evidence;
4. the 21-day vocabulary API returns cumulative catalogs by subscribed course level;
5. pronunciation feedback is transient, runs for five turns, and does not store microphone audio or transcripts.
6. common English function words and inflections resolve to their everyday learner meaning, not chemical symbols, place abbreviations, surnames, or other rare homographs.

The reproducible offline builder is [`scripts/build-smartlingo-vocabulary.py`](../scripts/build-smartlingo-vocabulary.py). It is not imported by the production application.
