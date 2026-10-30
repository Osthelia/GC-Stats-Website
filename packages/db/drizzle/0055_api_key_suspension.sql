ALTER TABLE "api_key" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_access_blocked_at" timestamp with time zone;