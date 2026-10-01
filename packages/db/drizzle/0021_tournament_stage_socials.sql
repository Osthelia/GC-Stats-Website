ALTER TABLE "tournaments" ADD COLUMN "liquipedia_link" text;--> statement-breakpoint
UPDATE "tournaments" SET "liquipedia_link" = "liquipedia_links"[1] WHERE array_length("liquipedia_links", 1) > 0;--> statement-breakpoint
ALTER TABLE "tournaments" DROP COLUMN "liquipedia_links";--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "socials" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "liquipedia_link" text;
