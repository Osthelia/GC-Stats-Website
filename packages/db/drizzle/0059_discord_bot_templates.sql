CREATE TABLE "discord_bot_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"event" text NOT NULL,
	"template" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discord_bot_templates_unique" ON "discord_bot_templates" USING btree ("guild_id","event");