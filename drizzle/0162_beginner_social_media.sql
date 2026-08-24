INSERT INTO smartlingo_learning_media_assets(asset_key,asset_path,media_kind,generation_source,release_id,subject_manifest_json,prompt_summary,reviewed_at,created_at)
VALUES(
  'beginner-social-vocabulary-sprite-2026-08-23',
  '/images/smartcards/beginner-social-vocabulary-sprite-2026-08-23.png',
  'image-sprite',
  'openai-image-generation',
  'bootstrap-2026-08-23',
  '["hello","please","thanks","sorry","yes","no","goodbye","help","man","woman","child","friend","home","family","food","phone"]',
  'Original SmartLingo 4x4 educational picture-choice sprite for greetings, polite actions, people, family, and daily essentials; no text, logos, or third-party characters.',
  unixepoch(),
  unixepoch()
)
ON CONFLICT(asset_key) DO UPDATE SET asset_path=excluded.asset_path,release_id=excluded.release_id,reviewed_at=excluded.reviewed_at;

PRAGMA optimize;
