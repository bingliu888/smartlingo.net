-- Existing Realtime calls still refund their shared text reservation on close.
-- GPT-Live calls use an independent daily voice allowance and never touch text time.
ALTER TABLE smartlingo_max_live_tutor_calls ADD COLUMN quota_kind TEXT NOT NULL DEFAULT 'shared'
  CHECK(quota_kind IN ('shared','voice'));
--> statement-breakpoint
DROP TRIGGER smartlingo_max_live_tutor_refund;
--> statement-breakpoint
CREATE TRIGGER smartlingo_max_live_tutor_refund
AFTER UPDATE OF status ON smartlingo_max_live_tutor_calls
FOR EACH ROW WHEN NEW.status='closed' AND OLD.status<>'closed' AND NEW.quota_kind='shared'
BEGIN
  UPDATE smartlingo_max_tutor_sessions
    SET used_seconds=MAX(0,used_seconds-(NEW.reserved_seconds-NEW.used_seconds)),
      last_active_at=NEW.ended_at,updated_at=NEW.ended_at
    WHERE id=NEW.tutor_session_id AND user_id=NEW.user_id
      AND usage_day=NEW.usage_day;
END;
