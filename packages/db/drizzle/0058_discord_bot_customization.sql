CREATE TABLE "discord_bot_guild_settings" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"bot_token_encrypted" text,
	"bot_user_id" text,
	"bot_name" text,
	"bot_avatar_url" text,
	"color_live" text,
	"color_finished" text,
	"color_map" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_bot_subscriptions" ADD COLUMN "color" text;