ALTER TABLE "tournaments" ADD COLUMN "is_ghost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "is_ghost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "is_ghost" boolean DEFAULT false NOT NULL;