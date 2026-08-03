ALTER TABLE `users` ADD COLUMN `ai_provider_preference` text DEFAULT 'auto' NOT NULL CHECK (`ai_provider_preference` IN ('auto', 'openai', 'deepseek'));
