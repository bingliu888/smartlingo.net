-- Replace an obsolete WordNet sub-sense with the common A1 meaning learners need.
-- Source: Princeton WordNet 3.0 / Open Multilingual WordNet 1.4, retrieved 2026-08-20.
UPDATE smartlingo_vocabulary_items
SET meaning_en='at a distance from a place; not here',
    meaning_zh='离开；在远处；不在这里',
    review_method='wordnet-common-a1-sense+curated-bilingual-gloss',
    updated_at=unixepoch()
WHERE target_language='en' AND lower(form)='away';
