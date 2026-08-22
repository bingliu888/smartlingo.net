ALTER TABLE smartlingo_vocabulary_items ADD COLUMN frequency_degree INTEGER NOT NULL DEFAULT 1 CHECK(frequency_degree BETWEEN 1 AND 10);
--> statement-breakpoint
UPDATE smartlingo_vocabulary_items
SET frequency_degree = CASE
  WHEN sequence <= 400 THEN 10
  WHEN sequence <= 800 THEN 9
  WHEN sequence <= 1200 THEN 8
  WHEN sequence <= 1600 THEN 7
  WHEN sequence <= 2000 THEN 6
  WHEN sequence <= 2400 THEN 5
  WHEN sequence <= 2800 THEN 4
  WHEN sequence <= 3200 THEN 3
  WHEN sequence <= 3600 THEN 2
  ELSE 1
END;
--> statement-breakpoint
CREATE INDEX smartlingo_vocabulary_learning_order_idx
ON smartlingo_vocabulary_items(target_language,review_status,difficulty,frequency_degree DESC,sequence);
