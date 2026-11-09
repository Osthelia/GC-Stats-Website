CREATE TABLE "discord_bot_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subscription_id" bigint NOT NULL,
	"match_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"message_id" text,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_bot_subscriptions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"event" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"filter_regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"filter_team_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
	"filter_official" text DEFAULT 'official' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_bot_messages" ADD CONSTRAINT "discord_bot_messages_subscription_id_discord_bot_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."discord_bot_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_bot_messages" ADD CONSTRAINT "discord_bot_messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discord_bot_messages_unique" ON "discord_bot_messages" USING btree ("subscription_id","match_id","kind");--> statement-breakpoint
CREATE INDEX "discord_bot_messages_match_id_idx" ON "discord_bot_messages" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "discord_bot_subscriptions_guild_id_idx" ON "discord_bot_subscriptions" USING btree ("guild_id");