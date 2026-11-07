CREATE TABLE "discord_bot_blacklist" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"discord_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_bot_image_reviews" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"event" text NOT NULL,
	"edited_by" text,
	"editor_discord_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discord_bot_blacklist_unique" ON "discord_bot_blacklist" USING btree ("kind","discord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discord_bot_image_reviews_unique" ON "discord_bot_image_reviews" USING btree ("guild_id","event");--> statement-breakpoint
CREATE INDEX "discord_bot_image_reviews_status_idx" ON "discord_bot_image_reviews" USING btree ("status","updated_at");--> statement-breakpoint
INSERT INTO "discord_bot_image_reviews" ("guild_id", "event")
SELECT "guild_id", "event" FROM "discord_bot_templates"
ON CONFLICT ("guild_id", "event") DO NOTHING;
