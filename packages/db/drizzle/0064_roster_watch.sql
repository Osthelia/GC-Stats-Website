CREATE TABLE "x_monitored_accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"x_handle" text NOT NULL,
	"x_user_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_tweet_id" text,
	"last_polled_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x_roster_signals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tweet_id" text NOT NULL,
	"account_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"tweet_url" text NOT NULL,
	"text" text NOT NULL,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tweeted_at" timestamp with time zone NOT NULL,
	"stage" text NOT NULL,
	"exclusion_rule_id" text,
	"verdict" text,
	"topic" text,
	"players" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"llm_reason" text,
	"llm_model" text,
	"llm_input_tokens" integer,
	"llm_output_tokens" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_topic" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "x_roster_signals_tweet_id_unique" UNIQUE("tweet_id")
);
--> statement-breakpoint
ALTER TABLE "x_monitored_accounts" ADD CONSTRAINT "x_monitored_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_roster_signals" ADD CONSTRAINT "x_roster_signals_account_id_x_monitored_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."x_monitored_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_roster_signals" ADD CONSTRAINT "x_roster_signals_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_roster_signals" ADD CONSTRAINT "x_roster_signals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "x_monitored_accounts_handle_uidx" ON "x_monitored_accounts" USING btree ("x_handle");--> statement-breakpoint
CREATE INDEX "x_monitored_accounts_team_id_idx" ON "x_monitored_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "x_roster_signals_verdict_status_idx" ON "x_roster_signals" USING btree ("verdict","status");--> statement-breakpoint
CREATE INDEX "x_roster_signals_stage_idx" ON "x_roster_signals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "x_roster_signals_team_id_idx" ON "x_roster_signals" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "x_roster_signals_tweeted_at_idx" ON "x_roster_signals" USING btree ("tweeted_at");--> statement-breakpoint
CREATE INDEX "x_roster_signals_review_topic_idx" ON "x_roster_signals" USING btree ("review_topic");