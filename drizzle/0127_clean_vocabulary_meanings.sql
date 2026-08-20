-- Meanings are learner-facing answers. Scene and target-language metadata are
-- stored in their own columns and must not be repeated inside the meaning.
UPDATE smartlingo_vocabulary_items
SET meaning_en=trim(substr(meaning_en,1,instr(meaning_en,' · ')-1)),
    meaning_zh=trim(substr(meaning_zh,1,instr(meaning_zh,' · ')-1)),
    updated_at=unixepoch()
WHERE source_type='smartlingo_original'
  AND instr(meaning_en,' · ')>0
  AND instr(meaning_zh,' · ')>0;
