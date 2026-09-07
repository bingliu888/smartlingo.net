-- RAE, https://dle.rae.es/su (checked 2026-09-07): possessive before a noun.
-- Correct the learner gloss without replacing vocabulary identities or activity.
UPDATE smartlingo_vocabulary_items
SET meaning_en='his; her; its; their; your (formal, before a noun)',
    meaning_zh='他的；她的；它的；他们的；您的（用于名词前）',
    updated_at=unixepoch()
WHERE target_language='es' AND lower(form)='su'
  AND (meaning_en<>'his; her; its; their; your (formal, before a noun)'
       OR meaning_zh<>'他的；她的；它的；他们的；您的（用于名词前）');
