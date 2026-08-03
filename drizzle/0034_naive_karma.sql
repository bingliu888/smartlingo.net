ALTER TABLE `smartlingo_daily_session_checkpoints` ADD `last_operation_fingerprint` text;--> statement-breakpoint
ALTER TABLE `smartlingo_daily_sync_operations` ADD `request_fingerprint` text;--> statement-breakpoint
DROP TRIGGER IF EXISTS `smartlingo_daily_checkpoint_revision_update_trg`;--> statement-breakpoint
CREATE TRIGGER `smartlingo_daily_checkpoint_operation_evidence_guard_trg`
BEFORE UPDATE OF `revision` ON `smartlingo_daily_session_checkpoints`
WHEN NEW.`revision` = OLD.`revision` + 1
  AND (NEW.`last_operation_id` IS NULL
    OR NEW.`last_operation_fingerprint` IS NULL
    OR length(NEW.`last_operation_fingerprint`) <> 64)
BEGIN
  SELECT RAISE(ABORT, 'SmartLingo checkpoint updates require operation evidence');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_daily_checkpoint_revision_update_trg`
AFTER UPDATE OF `draft_json`,`active_step`,`revision` ON `smartlingo_daily_session_checkpoints`
WHEN NEW.`revision` = OLD.`revision` + 1
BEGIN
  INSERT INTO `smartlingo_daily_checkpoint_revisions`
    (`checkpoint_id`,`revision`,`draft_json`,`active_step`,`created_at`)
  VALUES (NEW.`id`,NEW.`revision`,NEW.`draft_json`,NEW.`active_step`,NEW.`updated_at`);
  INSERT INTO `smartlingo_daily_sync_operations`
    (`id`,`checkpoint_id`,`user_id`,`operation`,`request_fingerprint`,`created_at`)
  SELECT NEW.`last_operation_id`,NEW.`id`,NEW.`user_id`,'save_draft',NEW.`last_operation_fingerprint`,NEW.`updated_at`
  WHERE NEW.`last_operation_id` IS NOT NULL;
END;
