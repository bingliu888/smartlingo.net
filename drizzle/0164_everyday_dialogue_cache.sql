INSERT INTO smartlingo_learning_content_releases(content_key,release_id,released_at,updated_at)
VALUES('everyday-dialogues','bootstrap-2026-08-23',unixepoch(),unixepoch())
ON CONFLICT(content_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS smartlingo_everyday_dialogue_sets (
  cache_key TEXT PRIMARY KEY,
  release_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
  scenario TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_type TEXT NOT NULL CHECK(source_type IN ('gpt-5.6-luna','safe-fallback')),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS smartlingo_everyday_dialogue_release_idx
ON smartlingo_everyday_dialogue_sets(release_id,target_language,level,scenario,created_at DESC);

INSERT INTO smartlingo_learning_media_assets(asset_key,asset_path,media_kind,generation_source,release_id,subject_manifest_json,prompt_summary,reviewed_at,created_at)
SELECT
  'everyday-speaking-' || value || '-motion-2026-08-23',
  '/everyday-speaking/' || value || '/conversation-01.gif',
  'short-video',
  'openai-image-generation',
  'bootstrap-2026-08-23',
  json_array(
    '/everyday-speaking/' || value || '/conversation-01.gif','/everyday-speaking/' || value || '/conversation-02.gif',
    '/everyday-speaking/' || value || '/conversation-03.gif','/everyday-speaking/' || value || '/conversation-04.gif',
    '/everyday-speaking/' || value || '/conversation-05.gif','/everyday-speaking/' || value || '/conversation-06.gif',
    '/everyday-speaking/' || value || '/conversation-07.gif','/everyday-speaking/' || value || '/conversation-08.gif',
    '/everyday-speaking/' || value || '/conversation-09.gif','/everyday-speaking/' || value || '/conversation-10.gif'
  ),
  'Original real-person paired conversational keyframes generated for a SmartLingo practical question-and-answer scenario; no logos, captions, or third-party characters.',
  unixepoch(),
  unixepoch()
FROM json_each('["airport","hotel","restaurant","hospital","cafe","school","library","grocery","transit","pharmacy","bank","police"]')
WHERE 1
ON CONFLICT(asset_key) DO UPDATE SET asset_path=excluded.asset_path,release_id=excluded.release_id,subject_manifest_json=excluded.subject_manifest_json,reviewed_at=excluded.reviewed_at;

PRAGMA optimize;
