ALTER TABLE `message_call_participants` ADD `microphone_on` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `message_call_participants` ADD `camera_on` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `message_calls` ADD `last_audio_at` integer;
