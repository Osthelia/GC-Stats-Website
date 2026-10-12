CREATE TABLE "match_veto_sessions" (
	"match_id" bigint PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"ready_a" boolean DEFAULT false NOT NULL,
	"ready_b" boolean DEFAULT false NOT NULL,
	"coin_toss_winner_id" bigint,
	"first_entrant_id" bigint,
	"map_pool" text[] DEFAULT '{}' NOT NULL,
	"step_started_at" timestamp with time zone,
	"staff_notified_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_veto_settings" (
	"tournament_id" bigint PRIMARY KEY NOT NULL,
	"first_mover_mode" text DEFAULT 'coin_toss' NOT NULL,
	"advantage_entrant_id" bigint,
	"predefined_slot" char(1) DEFAULT 'a' NOT NULL,
	"action_timeout_seconds" integer DEFAULT 60 NOT NULL,
	"map_pool" text[] DEFAULT '{}' NOT NULL,
	"map_pool_patch" text
);
--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "veto_token" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "veto_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "match_veto_sessions" ADD CONSTRAINT "match_veto_sessions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_veto_sessions" ADD CONSTRAINT "match_veto_sessions_coin_toss_winner_id_entrants_id_fk" FOREIGN KEY ("coin_toss_winner_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_veto_sessions" ADD CONSTRAINT "match_veto_sessions_first_entrant_id_entrants_id_fk" FOREIGN KEY ("first_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_veto_settings" ADD CONSTRAINT "tournament_veto_settings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_veto_settings" ADD CONSTRAINT "tournament_veto_settings_advantage_entrant_id_entrants_id_fk" FOREIGN KEY ("advantage_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_veto_token_unique" UNIQUE("veto_token");