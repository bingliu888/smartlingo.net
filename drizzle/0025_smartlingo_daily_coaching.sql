CREATE TABLE `smartlingo_daily_learning_preferences` (
  `user_id` text NOT NULL,
  `class_id` text NOT NULL,
  `session_minutes` integer DEFAULT 15 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`user_id`,`class_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade,
  FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON DELETE cascade,
  CONSTRAINT `smartlingo_daily_preference_minutes_ck` CHECK(`session_minutes` IN (15,30,45,60))
);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_preference_user_updated_idx` ON `smartlingo_daily_learning_preferences` (`user_id`,`updated_at`);--> statement-breakpoint

CREATE TABLE `smartlingo_daily_quiz_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `class_id` text NOT NULL,
  `local_date` text NOT NULL,
  `target_language` text NOT NULL,
  `content_version` text NOT NULL,
  `attempt_number` integer NOT NULL,
  `score` integer NOT NULL,
  `correct_count` integer NOT NULL,
  `question_count` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade,
  FOREIGN KEY (`class_id`) REFERENCES `smartlingo_language_classes`(`id`) ON DELETE cascade,
  CONSTRAINT `smartlingo_daily_quiz_date_ck` CHECK(`local_date` GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CONSTRAINT `smartlingo_daily_quiz_language_ck` CHECK(`target_language` IN ('zh','en','es','ja','ko','fr','de','ru','it','pt','ar','hi')),
  CONSTRAINT `smartlingo_daily_quiz_attempt_ck` CHECK(`attempt_number` BETWEEN 1 AND 20),
  CONSTRAINT `smartlingo_daily_quiz_score_ck` CHECK(`score` BETWEEN 0 AND 100),
  CONSTRAINT `smartlingo_daily_quiz_counts_ck` CHECK(`question_count` BETWEEN 1 AND 20 AND `correct_count` BETWEEN 0 AND `question_count`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `smartlingo_daily_quiz_attempt_uq` ON `smartlingo_daily_quiz_attempts` (`user_id`,`class_id`,`local_date`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_quiz_user_date_idx` ON `smartlingo_daily_quiz_attempts` (`user_id`,`local_date`,`created_at`);--> statement-breakpoint
CREATE INDEX `smartlingo_daily_quiz_class_date_idx` ON `smartlingo_daily_quiz_attempts` (`class_id`,`local_date`,`created_at`);
