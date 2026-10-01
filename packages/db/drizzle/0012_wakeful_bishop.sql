ALTER TABLE "matches" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
UPDATE "matches" SET "status" = 'pending' WHERE "status" = 'ready';--> statement-breakpoint
DROP TYPE "public"."match_status";--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'live', 'completed');--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."match_status";--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "status" SET DATA TYPE "public"."match_status" USING "status"::"public"."match_status";