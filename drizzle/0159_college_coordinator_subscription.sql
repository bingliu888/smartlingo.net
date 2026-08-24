ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id TEXT;
--> statement-breakpoint
ALTER TABLE subscriptions ADD COLUMN stripe_customer_id TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_unique ON subscriptions(stripe_subscription_id);
--> statement-breakpoint
CREATE INDEX subscriptions_cadence_status_idx ON subscriptions(cadence,status,current_period_ends_at);
