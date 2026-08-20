-- Store learner-facing pronunciation aids for every SmartLingo interface language.
-- IPA in target_phonetic remains the language-neutral authority; these guides are
-- explicitly approximate reading aids and must never replace the target audio.
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN pronunciation_guides TEXT NOT NULL DEFAULT '{}';
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN pronunciation_guide_version TEXT NOT NULL DEFAULT 'sl-guide-v1';
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN lexical_source_url TEXT NOT NULL DEFAULT 'https://smartlingo.net/project';
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN lexical_source_license TEXT NOT NULL DEFAULT 'SmartLingo original';
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN lexical_source_revision TEXT NOT NULL DEFAULT '2026-08-20';
ALTER TABLE smartlingo_vocabulary_items ADD COLUMN review_method TEXT NOT NULL DEFAULT 'existing-reviewed-catalog';

UPDATE smartlingo_vocabulary_items
SET pronunciation_guides = json_object(
  'zh', pronunciation_zh,
  'en', pronunciation_en,
  'es', pronunciation_en,
  'ja', pronunciation_en,
  'ko', pronunciation_en,
  'fr', pronunciation_en,
  'de', pronunciation_en,
  'ru', pronunciation_en,
  'it', pronunciation_en,
  'pt', pronunciation_en,
  'ar', pronunciation_en,
  'hi', pronunciation_en
), updated_at = unixepoch();

DROP TRIGGER IF EXISTS smartlingo_vocabulary_multilingual_pronunciation_insert_trg;
CREATE TRIGGER smartlingo_vocabulary_multilingual_pronunciation_insert_trg
BEFORE INSERT ON smartlingo_vocabulary_items
FOR EACH ROW
WHEN NEW.review_status = 'published' AND (
  length(trim(NEW.target_phonetic)) = 0
  OR length(trim(NEW.lexical_source_url)) = 0
  OR length(trim(NEW.lexical_source_license)) = 0
  OR length(trim(NEW.lexical_source_revision)) = 0
  OR length(trim(NEW.review_method)) = 0
  OR json_valid(NEW.pronunciation_guides) = 0
  OR json_type(NEW.pronunciation_guides) <> 'object'
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.zh'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.en'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.es'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ja'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ko'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.fr'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.de'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ru'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.it'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.pt'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ar'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.hi'), ''))) = 0
)
BEGIN
  SELECT RAISE(ABORT, 'published vocabulary requires IPA and all 12 pronunciation guides');
END;

DROP TRIGGER IF EXISTS smartlingo_vocabulary_multilingual_pronunciation_update_trg;
CREATE TRIGGER smartlingo_vocabulary_multilingual_pronunciation_update_trg
BEFORE UPDATE OF review_status, target_phonetic, pronunciation_guides ON smartlingo_vocabulary_items
FOR EACH ROW
WHEN NEW.review_status = 'published' AND (
  length(trim(NEW.target_phonetic)) = 0
  OR length(trim(NEW.lexical_source_url)) = 0
  OR length(trim(NEW.lexical_source_license)) = 0
  OR length(trim(NEW.lexical_source_revision)) = 0
  OR length(trim(NEW.review_method)) = 0
  OR json_valid(NEW.pronunciation_guides) = 0
  OR json_type(NEW.pronunciation_guides) <> 'object'
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.zh'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.en'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.es'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ja'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ko'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.fr'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.de'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ru'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.it'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.pt'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.ar'), ''))) = 0
  OR length(trim(COALESCE(json_extract(NEW.pronunciation_guides, '$.hi'), ''))) = 0
)
BEGIN
  SELECT RAISE(ABORT, 'published vocabulary requires IPA and all 12 pronunciation guides');
END;
