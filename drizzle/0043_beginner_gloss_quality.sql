-- Forward-only corrections discovered by the 2026-08-21 real-user learning QA.
-- Keep high-frequency beginner glosses concise, natural, and useful in isolation.

UPDATE smartlingo_vocabulary_items
SET meaning_en='president; chairperson; leader',
    meaning_zh='总统；主席；负责人',
    updated_at=unixepoch()
WHERE target_language IN ('es','fr','it','pt') AND lower(form) IN ('presidente','président');

UPDATE smartlingo_vocabulary_items
SET meaning_en='chairperson; leader',
    meaning_zh='主席；负责人',
    updated_at=unixepoch()
WHERE target_language='ru' AND form='председатель';

UPDATE smartlingo_vocabulary_items
SET meaning_en='really; truly; in fact',
    meaning_zh='真的；确实；事实上',
    updated_at=unixepoch()
WHERE target_language='it' AND lower(form)='davvero';

UPDATE smartlingo_vocabulary_items
SET meaning_en='no one; nobody; none',
    meaning_zh='没有人；没有任何一个',
    updated_at=unixepoch()
WHERE target_language='it' AND lower(form)='nessuno';

UPDATE smartlingo_vocabulary_items
SET meaning_en='new (feminine singular); news',
    meaning_zh='新的（阴性单数）；消息',
    updated_at=unixepoch()
WHERE (target_language='it' AND lower(form)='nuova')
   OR (target_language='fr' AND lower(form)='nouvelle')
   OR (target_language='pt' AND lower(form)='nova');
