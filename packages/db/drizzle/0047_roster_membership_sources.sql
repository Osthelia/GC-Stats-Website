ALTER TABLE "roster_memberships" ADD COLUMN IF NOT EXISTS "join_source" text;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD COLUMN IF NOT EXISTS "left_source" text;