CREATE TABLE "discord_bot_image_decisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"event" text NOT NULL,
	"decision" text NOT NULL,
	"sanctions" text[] DEFAULT '{}'::text[] NOT NULL,
	"reason" text,
	"edited_by" text,
	"editor_discord_id" text,
	"decided_by" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "discord_bot_image_decisions_decided_at_idx" ON "discord_bot_image_decisions" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "discord_bot_image_decisions_guild_id_idx" ON "discord_bot_image_decisions" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "discord_bot_image_decisions_editor_discord_id_idx" ON "discord_bot_image_decisions" USING btree ("editor_discord_id");