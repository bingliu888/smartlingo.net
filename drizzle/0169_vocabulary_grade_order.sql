ALTER TABLE smartlingo_vocabulary_items ADD COLUMN grade_level INTEGER NOT NULL DEFAULT 0 CHECK(grade_level BETWEEN 0 AND 12);
--> statement-breakpoint
UPDATE smartlingo_vocabulary_items
SET grade_level = CASE
  WHEN sequence <= 120 THEN 0
  WHEN sequence <= 300 THEN 1
  WHEN sequence <= 500 THEN 2
  WHEN sequence <= 700 THEN 3
  WHEN sequence <= 900 THEN 4
  WHEN sequence <= 1100 THEN 5
  WHEN sequence <= 1400 THEN 6
  WHEN sequence <= 1700 THEN 7
  WHEN sequence <= 2000 THEN 8
  WHEN sequence <= 2400 THEN 9
  WHEN sequence <= 2800 THEN 10
  WHEN sequence <= 3300 THEN 11
  ELSE 12
END;
--> statement-breakpoint
DROP INDEX IF EXISTS smartlingo_vocabulary_learning_order_idx;
--> statement-breakpoint
CREATE INDEX smartlingo_vocabulary_learning_order_idx
ON smartlingo_vocabulary_items(target_language,review_status,difficulty,frequency_degree DESC,grade_level,sequence);
