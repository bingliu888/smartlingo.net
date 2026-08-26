ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1 CHECK(email_verified IN (0,1));
--> statement-breakpoint
CREATE INDEX users_email_verification_idx ON users(email_verified,email);
--> statement-breakpoint
PRAGMA optimize;
