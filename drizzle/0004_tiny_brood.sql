CREATE TABLE `editorial_documents` (
	`kind` text PRIMARY KEY NOT NULL,
	`edition_date` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
