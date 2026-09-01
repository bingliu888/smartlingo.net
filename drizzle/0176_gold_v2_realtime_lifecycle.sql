-- SmartLingo Gold v2 realtime lifecycle. Each provider generation owns a
-- two-hour clock and a tab-scoped credential. D1 triggers serialize capacity
-- writes, so concurrent joins cannot exceed the room or stage limits.

-- The classroom migrations predate SmartLingo's tracked fresh-D1 journal.
-- Keep this Gold migration additive and self-contained for disaster recovery;
-- production databases already have the same room shape.
CREATE TABLE IF NOT EXISTS live_class_rooms (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE CHECK(length(code)=6),
  host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_email TEXT NOT NULL,
  host_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  class_type TEXT NOT NULL DEFAULT 'public' CHECK(class_type IN ('public','trial','private')),
  streaming_mode TEXT NOT NULL DEFAULT 'video' CHECK(streaming_mode IN ('audio','video')),
  realtime_mode TEXT NOT NULL DEFAULT 'group_call' CHECK(realtime_mode IN ('group_call','webinar','livestream')),
  starts_at INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 15 AND 480),
  trial_minutes INTEGER NOT NULL DEFAULT 30 CHECK(trial_minutes BETWEEN 0 AND 1440),
  tuition_cents INTEGER NOT NULL DEFAULT 0 CHECK(tuition_cents>=0),
  password_hash TEXT,
  provider_meeting_id TEXT,
  stream_active INTEGER NOT NULL DEFAULT 0 CHECK(stream_active IN (0,1)),
  mute_all INTEGER NOT NULL DEFAULT 1 CHECK(mute_all IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE live_class_rooms ADD COLUMN live_started_at INTEGER;
ALTER TABLE live_class_rooms ADD COLUMN provider_generation INTEGER NOT NULL DEFAULT 0
  CHECK(provider_generation >= 0);
ALTER TABLE live_class_rooms ADD COLUMN provider_generation_started_at INTEGER;
ALTER TABLE live_class_rooms ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE live_class_rooms ADD COLUMN provider_create_deadline_at INTEGER;

UPDATE live_class_rooms SET live_started_at=NULL,provider_generation_started_at=NULL
WHERE provider_meeting_id IS NULL;

CREATE TABLE class_realtime_capacity_ledger (
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  participant_count INTEGER NOT NULL DEFAULT 0 CHECK(participant_count >= 0),
  publisher_count INTEGER NOT NULL DEFAULT 0 CHECK(publisher_count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,generation)
) WITHOUT ROWID;

CREATE TABLE class_participant_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL CHECK(generation >= 0),
  media_identity TEXT NOT NULL,
  human_identity TEXT NOT NULL CHECK(length(human_identity) BETWEEN 8 AND 180),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  role TEXT NOT NULL CHECK(role IN ('viewer','guest','member','host')),
  token_hash TEXT NOT NULL UNIQUE,
  provider_meeting_id TEXT,
  provider_participant_id TEXT,
  companion_provider_participant_id TEXT,
  companion_reserved INTEGER NOT NULL DEFAULT 0 CHECK(companion_reserved IN (0,1)),
  publisher_reserved INTEGER NOT NULL DEFAULT 0 CHECK(publisher_reserved IN (0,1)),
  companion_publisher_reserved INTEGER NOT NULL DEFAULT 0 CHECK(companion_publisher_reserved IN (0,1)),
  publisher_started_at INTEGER,
  publisher_interrupted_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  joined_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revocation_reason TEXT CHECK(revocation_reason IN ('leave','expired','moderator_kick','generation_end')),
  UNIQUE(room_id,media_identity)
);
CREATE INDEX class_participant_sessions_active_idx
  ON class_participant_sessions(room_id,generation,active,last_seen_at);
CREATE INDEX class_participant_sessions_human_idx
  ON class_participant_sessions(room_id,human_identity,active,last_seen_at);
CREATE INDEX class_participant_sessions_provider_idx
  ON class_participant_sessions(provider_meeting_id,provider_participant_id);
CREATE INDEX class_participant_sessions_publisher_lease_idx
  ON class_participant_sessions(publisher_started_at,room_id,id)
  WHERE publisher_started_at IS NOT NULL;

CREATE TRIGGER class_session_participant_limit_insert
BEFORE INSERT ON class_participant_sessions
WHEN NEW.active=1 AND COALESCE((
  SELECT participant_count FROM class_realtime_capacity_ledger
  WHERE room_id=NEW.room_id AND generation=NEW.generation
),0) >= COALESCE((
  SELECT CASE WHEN realtime_mode='group_call' THEN 100 ELSE 1000 END
  FROM live_class_rooms WHERE id=NEW.room_id
),0)
BEGIN SELECT RAISE(ABORT,'STREAMING_ROOM_FULL'); END;

CREATE TRIGGER class_session_publisher_limit_insert
BEFORE INSERT ON class_participant_sessions
WHEN NEW.active=1 AND (NEW.publisher_reserved=1 OR NEW.companion_publisher_reserved=1)
  AND COALESCE((SELECT publisher_count FROM class_realtime_capacity_ledger
    WHERE room_id=NEW.room_id AND generation=NEW.generation),0)
  + NEW.publisher_reserved + NEW.companion_publisher_reserved
  > COALESCE((SELECT CASE WHEN realtime_mode='group_call' THEN 100 ELSE 9 END
    FROM live_class_rooms WHERE id=NEW.room_id),0)
BEGIN SELECT RAISE(ABORT,'PUBLISHER_LIMIT_REACHED'); END;

CREATE TRIGGER class_session_capacity_after_insert
AFTER INSERT ON class_participant_sessions WHEN NEW.active=1
BEGIN
  INSERT INTO class_realtime_capacity_ledger(
    room_id,generation,participant_count,publisher_count,updated_at
  ) VALUES(
    NEW.room_id,NEW.generation,1,
    NEW.publisher_reserved+NEW.companion_publisher_reserved,unixepoch()
  ) ON CONFLICT(room_id,generation) DO UPDATE SET
    participant_count=participant_count+1,
    publisher_count=publisher_count+NEW.publisher_reserved+NEW.companion_publisher_reserved,
    updated_at=unixepoch();
END;

CREATE TRIGGER class_session_participant_limit_update
BEFORE UPDATE OF active ON class_participant_sessions
WHEN OLD.active=0 AND NEW.active=1 AND COALESCE((
  SELECT participant_count FROM class_realtime_capacity_ledger
  WHERE room_id=NEW.room_id AND generation=NEW.generation
),0) >= COALESCE((
  SELECT CASE WHEN realtime_mode='group_call' THEN 100 ELSE 1000 END
  FROM live_class_rooms WHERE id=NEW.room_id
),0)
BEGIN SELECT RAISE(ABORT,'STREAMING_ROOM_FULL'); END;

CREATE TRIGGER class_session_publisher_limit_update
BEFORE UPDATE OF active,publisher_reserved,companion_publisher_reserved
ON class_participant_sessions
WHEN NEW.active=1
  AND (NEW.publisher_reserved+NEW.companion_publisher_reserved)
      > CASE WHEN OLD.active=1 THEN OLD.publisher_reserved+OLD.companion_publisher_reserved ELSE 0 END
  AND COALESCE((SELECT publisher_count FROM class_realtime_capacity_ledger
    WHERE room_id=NEW.room_id AND generation=NEW.generation),0)
      - CASE WHEN OLD.active=1 THEN OLD.publisher_reserved+OLD.companion_publisher_reserved ELSE 0 END
      + NEW.publisher_reserved+NEW.companion_publisher_reserved
    > COALESCE((SELECT CASE WHEN realtime_mode='group_call' THEN 100 ELSE 9 END
      FROM live_class_rooms WHERE id=NEW.room_id),0)
BEGIN SELECT RAISE(ABORT,'PUBLISHER_LIMIT_REACHED'); END;

CREATE TRIGGER class_session_capacity_after_update
AFTER UPDATE OF active,publisher_reserved,companion_publisher_reserved
ON class_participant_sessions
BEGIN
  INSERT OR IGNORE INTO class_realtime_capacity_ledger(
    room_id,generation,participant_count,publisher_count,updated_at
  ) VALUES(NEW.room_id,NEW.generation,0,0,unixepoch());
  UPDATE class_realtime_capacity_ledger SET
    participant_count=MAX(0,participant_count+NEW.active-OLD.active),
    publisher_count=MAX(0,publisher_count
      +(NEW.active*(NEW.publisher_reserved+NEW.companion_publisher_reserved))
      -(OLD.active*(OLD.publisher_reserved+OLD.companion_publisher_reserved))),
    updated_at=unixepoch()
  WHERE room_id=NEW.room_id AND generation=NEW.generation;
END;

CREATE TRIGGER class_session_capacity_after_delete
AFTER DELETE ON class_participant_sessions WHEN OLD.active=1
BEGIN
  UPDATE class_realtime_capacity_ledger SET
    participant_count=MAX(0,participant_count-1),
    publisher_count=MAX(0,publisher_count-OLD.publisher_reserved-OLD.companion_publisher_reserved),
    updated_at=unixepoch()
  WHERE room_id=OLD.room_id AND generation=OLD.generation;
END;

CREATE TABLE class_provider_create_attempts (
  correlation_id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL UNIQUE,
  provider_title TEXT NOT NULL UNIQUE,
  provider_meeting_id TEXT,
  discovery_attempts INTEGER NOT NULL DEFAULT 0 CHECK(discovery_attempts >= 0),
  no_match_confirmations INTEGER NOT NULL DEFAULT 0 CHECK(no_match_confirmations >= 0),
  next_attempt_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_provider_create_retry_idx
  ON class_provider_create_attempts(next_attempt_at,updated_at,correlation_id);

CREATE TABLE class_provider_teardown_jobs (
  provider_meeting_id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK(reason IN ('delete','idle','closed','duration','create_loser')),
  blocks_join INTEGER NOT NULL DEFAULT 1 CHECK(blocks_join IN (0,1)),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_provider_teardown_retry_idx
  ON class_provider_teardown_jobs(next_attempt_at,updated_at,provider_meeting_id);
CREATE INDEX class_provider_teardown_room_idx
  ON class_provider_teardown_jobs(room_id,blocks_join,updated_at);

CREATE TABLE class_deletion_jobs (
  room_id TEXT PRIMARY KEY NOT NULL,
  room_code TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_deletion_jobs_retry_idx
  ON class_deletion_jobs(next_attempt_at,updated_at,room_id);

CREATE TABLE provider_participant_cleanup_jobs (
  provider_meeting_id TEXT NOT NULL,
  provider_participant_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  participant_session_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(provider_meeting_id,provider_participant_id)
);
CREATE INDEX provider_participant_cleanup_retry_idx
  ON provider_participant_cleanup_jobs(next_attempt_at,updated_at,provider_meeting_id);

CREATE TABLE provider_participant_create_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  participant_session_id TEXT NOT NULL,
  provider_meeting_id TEXT NOT NULL,
  custom_participant_id TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  not_found_confirmations INTEGER NOT NULL DEFAULT 0 CHECK(not_found_confirmations >= 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_check_at INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_meeting_id,custom_participant_id),
  UNIQUE(participant_session_id)
);
CREATE INDEX provider_participant_create_recovery_due_idx
  ON provider_participant_create_attempts(next_check_at,updated_at,id);
CREATE INDEX provider_participant_create_room_idx
  ON provider_participant_create_attempts(room_id,created_at);

CREATE TABLE class_participant_bans (
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  human_identity TEXT NOT NULL CHECK(length(human_identity) BETWEEN 8 AND 180),
  user_id TEXT,
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 80),
  banned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'moderator_kick' CHECK(reason='moderator_kick'),
  banned_at INTEGER NOT NULL,
  PRIMARY KEY(room_id,human_identity)
);
CREATE INDEX class_participant_bans_recent_idx
  ON class_participant_bans(room_id,banned_at DESC);

CREATE TABLE class_password_failures (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  actor_key TEXT NOT NULL,
  failure_count INTEGER NOT NULL CHECK(failure_count > 0),
  window_started_at INTEGER NOT NULL,
  last_failed_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL,
  UNIQUE(room_id,actor_key)
);
CREATE INDEX class_password_failures_age_idx
  ON class_password_failures(last_failed_at,id);

CREATE TABLE class_shared_content_state (
  room_id TEXT PRIMARY KEY NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL DEFAULT 0,
  media_identity TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('screen','camera','file','web','whiteboard')),
  label TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  claim_token TEXT,
  lease_until INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_shared_content_lease_idx
  ON class_shared_content_state(active,lease_until,room_id);

CREATE TABLE class_recording_claims (
  room_id TEXT PRIMARY KEY NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  participant_session_id TEXT REFERENCES class_participant_sessions(id) ON DELETE SET NULL,
  claim_token TEXT NOT NULL,
  correlation_id TEXT NOT NULL UNIQUE,
  attempted_provider_meeting_id TEXT NOT NULL,
  provider_recording_id TEXT,
  artifact_id TEXT NOT NULL UNIQUE,
  quota_reservation_id TEXT NOT NULL UNIQUE,
  storage_reservation_id TEXT NOT NULL UNIQUE,
  provider_start_attempted_at INTEGER,
  not_found_confirmations INTEGER NOT NULL DEFAULT 0,
  next_check_at INTEGER,
  claimed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX class_recording_claims_recovery_idx
  ON class_recording_claims(next_check_at,claimed_at,room_id)
  WHERE provider_recording_id IS NULL;

CREATE TABLE class_recording_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES live_class_rooms(id) ON DELETE CASCADE,
  provider_recording_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('pending','recording','processing','ready','errored','deleted')),
  audio_r2_key TEXT,
  audio_size_bytes INTEGER NOT NULL DEFAULT 0,
  recording_seconds INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX class_recording_one_active_idx
  ON class_recording_artifacts(room_id)
  WHERE status IN ('pending','recording','processing');

CREATE TABLE provider_recording_cleanup_jobs (
  provider_recording_id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  next_attempt_at INTEGER NOT NULL,
  last_error TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX provider_recording_cleanup_retry_idx
  ON provider_recording_cleanup_jobs(next_attempt_at,updated_at,provider_recording_id);

CREATE TABLE webhook_processing_claims (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  claimed_at INTEGER NOT NULL
);
CREATE INDEX webhook_processing_claims_age_idx
  ON webhook_processing_claims(provider,claimed_at,id);

CREATE TABLE processed_webhooks (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);
CREATE INDEX processed_webhooks_retention_idx
  ON processed_webhooks(processed_at,id);

CREATE INDEX live_class_rooms_provider_idle_sweep_idx
  ON live_class_rooms(COALESCE(provider_generation_started_at,updated_at,0),id)
  WHERE provider_meeting_id IS NOT NULL;
