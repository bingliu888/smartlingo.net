CREATE TABLE `smartlingo_daily_checkpoint_revisions` (
	`checkpoint_id` text NOT NULL,
	`revision` integer NOT NULL,
	`draft_json` text NOT NULL,
	`active_step` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`checkpoint_id`, `revision`),
	FOREIGN KEY (`checkpoint_id`) REFERENCES `smartlingo_daily_session_checkpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "smartlingo_daily_checkpoint_history_revision_ck" CHECK("smartlingo_daily_checkpoint_revisions"."revision" >= 1),
	CONSTRAINT "smartlingo_daily_checkpoint_history_draft_ck" CHECK(json_valid("smartlingo_daily_checkpoint_revisions"."draft_json") AND json_type("smartlingo_daily_checkpoint_revisions"."draft_json") = 'object' AND length("smartlingo_daily_checkpoint_revisions"."draft_json") <= 12000),
	CONSTRAINT "smartlingo_daily_checkpoint_history_step_ck" CHECK("smartlingo_daily_checkpoint_revisions"."active_step" IN ('vocabulary', 'reading', 'writing', 'listening', 'dialogue', 'exam', 'recap'))
);
--> statement-breakpoint
CREATE INDEX `smartlingo_daily_checkpoint_history_created_idx` ON `smartlingo_daily_checkpoint_revisions` (`checkpoint_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `smartlingo_daily_session_checkpoints` ADD `last_operation_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_daily_checkpoint_last_operation_uq` ON `smartlingo_daily_session_checkpoints` (`last_operation_id`) WHERE "smartlingo_daily_session_checkpoints"."last_operation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `smartlingo_learning_streaks` ADD `revision` integer DEFAULT 0 NOT NULL CHECK (`revision` >= 0);--> statement-breakpoint
INSERT OR IGNORE INTO `smartlingo_daily_checkpoint_revisions`
  (`checkpoint_id`,`revision`,`draft_json`,`active_step`,`created_at`)
  SELECT `id`,`revision`,`draft_json`,`active_step`,`updated_at`
  FROM `smartlingo_daily_session_checkpoints`;--> statement-breakpoint
CREATE TRIGGER `smartlingo_daily_checkpoint_revision_insert_trg`
AFTER INSERT ON `smartlingo_daily_session_checkpoints`
BEGIN
  INSERT INTO `smartlingo_daily_checkpoint_revisions`
    (`checkpoint_id`,`revision`,`draft_json`,`active_step`,`created_at`)
  VALUES (NEW.`id`,NEW.`revision`,NEW.`draft_json`,NEW.`active_step`,NEW.`updated_at`);
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_daily_checkpoint_revision_update_guard_trg`
BEFORE UPDATE OF `revision` ON `smartlingo_daily_session_checkpoints`
WHEN NEW.`revision` <> OLD.`revision` + 1
BEGIN
  SELECT RAISE(ABORT, 'SmartLingo checkpoint revisions must advance exactly once');
END;--> statement-breakpoint
CREATE TRIGGER `smartlingo_daily_checkpoint_revision_update_trg`
AFTER UPDATE OF `draft_json`,`active_step`,`revision` ON `smartlingo_daily_session_checkpoints`
WHEN NEW.`revision` = OLD.`revision` + 1
BEGIN
  INSERT INTO `smartlingo_daily_checkpoint_revisions`
    (`checkpoint_id`,`revision`,`draft_json`,`active_step`,`created_at`)
  VALUES (NEW.`id`,NEW.`revision`,NEW.`draft_json`,NEW.`active_step`,NEW.`updated_at`);
  INSERT INTO `smartlingo_daily_sync_operations`
    (`id`,`checkpoint_id`,`user_id`,`operation`,`created_at`)
  SELECT NEW.`last_operation_id`,NEW.`id`,NEW.`user_id`,'save_draft',NEW.`updated_at`
  WHERE NEW.`last_operation_id` IS NOT NULL;
END;
