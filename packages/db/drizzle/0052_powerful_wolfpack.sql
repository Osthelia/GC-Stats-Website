--> statement-breakpoint
CREATE TABLE "lol_game_draft" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"champion_name" text NOT NULL,
	"type" text NOT NULL,
	"order" integer,
	CONSTRAINT "lol_game_draft_game_champion_unique" UNIQUE("game_id","champion_name")
);
--> statement-breakpoint
CREATE TABLE "lol_game_events_raw" (
	"game_id" bigint NOT NULL,
	"seq" smallint NOT NULL,
	"time_ms" integer NOT NULL,
	"type" text NOT NULL,
	"person_id" bigint,
	"target_person_id" bigint,
	"assistant_person_ids" bigint[],
	"side" text,
	"x" integer,
	"y" integer,
	"subtype" text,
	"lane" text,
	"item_id" integer,
	"skill_slot" smallint,
	"bounty" integer,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "lol_game_events_raw_game_id_seq_pk" PRIMARY KEY("game_id","seq"),
	CONSTRAINT "lol_game_events_raw_kill_target_check" CHECK ("lol_game_events_raw"."type" <> 'CHAMPION_KILL' OR "lol_game_events_raw"."target_person_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "lol_game_frames_raw" (
	"game_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"frame" smallint NOT NULL,
	"time_ms" integer NOT NULL,
	"total_gold" integer NOT NULL,
	"current_gold" integer NOT NULL,
	"xp" integer NOT NULL,
	"level" smallint NOT NULL,
	"cs" integer NOT NULL,
	"jungle_cs" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"damage_to_champions" integer NOT NULL,
	"damage_taken" integer NOT NULL,
	CONSTRAINT "lol_game_frames_raw_game_id_person_id_frame_pk" PRIMARY KEY("game_id","person_id","frame")
);
--> statement-breakpoint
CREATE TABLE "lol_game_player_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"person_id" bigint,
	"champion_name" text NOT NULL,
	"role" text,
	"kills" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"cs" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"damage" integer DEFAULT 0 NOT NULL,
	"vision" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summoners" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gold_diff_10" integer,
	"gold_diff_15" integer,
	"xp_diff_10" integer,
	"xp_diff_15" integer,
	"cs_diff_10" integer,
	"cs_diff_15" integer
);
--> statement-breakpoint
CREATE TABLE "lol_game_team_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"side" text NOT NULL,
	"kills" integer DEFAULT 0 NOT NULL,
	"towers" integer DEFAULT 0 NOT NULL,
	"inhibitors" integer DEFAULT 0 NOT NULL,
	"dragons" integer DEFAULT 0 NOT NULL,
	"barons" integer DEFAULT 0 NOT NULL,
	"heralds" integer DEFAULT 0 NOT NULL,
	"grubs" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"objectives" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_blood" boolean DEFAULT false NOT NULL,
	"first_tower" boolean DEFAULT false NOT NULL,
	"objective_timings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "lol_game_team_stats_game_side_unique" UNIQUE("game_id","side")
);
--> statement-breakpoint
CREATE TABLE "lol_games" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"order" integer NOT NULL,
	"api_match_id" text,
	"platform_id" text,
	"started_at" timestamp with time zone,
	"duration_seconds" integer,
	"winner_entrant_id" bigint,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"note" text,
	"source" text,
	CONSTRAINT "lol_games_api_match_id_unique" UNIQUE("api_match_id"),
	CONSTRAINT "lol_games_match_id_order_unique" UNIQUE("match_id","order")
);
--> statement-breakpoint
ALTER TABLE "lol_person_profiles" ADD COLUMN "lol_id" text;--> statement-breakpoint
ALTER TABLE "lol_person_profiles" ADD CONSTRAINT "lol_person_profiles_lol_id_unique" UNIQUE("lol_id");--> statement-breakpoint
DROP VIEW "lol_people";--> statement-breakpoint
DROP VIEW "val_people";--> statement-breakpoint
ALTER TABLE "lol_game_draft" ADD CONSTRAINT "lol_game_draft_game_id_lol_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."lol_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_draft" ADD CONSTRAINT "lol_game_draft_entrant_id_lol_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."lol_entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_events_raw" ADD CONSTRAINT "lol_game_events_raw_game_id_lol_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."lol_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_events_raw" ADD CONSTRAINT "lol_game_events_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_events_raw" ADD CONSTRAINT "lol_game_events_raw_target_person_id_people_id_fk" FOREIGN KEY ("target_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_frames_raw" ADD CONSTRAINT "lol_game_frames_raw_game_id_lol_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."lol_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_frames_raw" ADD CONSTRAINT "lol_game_frames_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ADD CONSTRAINT "lol_game_player_stats_game_id_lol_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."lol_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ADD CONSTRAINT "lol_game_player_stats_entrant_id_lol_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."lol_entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ADD CONSTRAINT "lol_game_player_stats_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_team_stats" ADD CONSTRAINT "lol_game_team_stats_game_id_lol_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."lol_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_game_team_stats" ADD CONSTRAINT "lol_game_team_stats_entrant_id_lol_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."lol_entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_games" ADD CONSTRAINT "lol_games_match_id_lol_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."lol_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_games" ADD CONSTRAINT "lol_games_winner_entrant_id_lol_entrants_id_fk" FOREIGN KEY ("winner_entrant_id") REFERENCES "public"."lol_entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lol_game_player_stats_entrant_id_idx" ON "lol_game_player_stats" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "lol_game_player_stats_person_id_idx" ON "lol_game_player_stats" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "lol_game_team_stats_entrant_id_idx" ON "lol_game_team_stats" USING btree ("entrant_id");--> statement-breakpoint
ALTER TABLE "lol_vods" ADD CONSTRAINT "lol_vods_map_id_lol_games_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."lol_games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_production_credits" ADD CONSTRAINT "lol_production_credits_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "public"."lol_games"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE VIEW "public"."lol_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "lol_person_profiles"."is_active", "lol_person_profiles"."is_ghost", "lol_person_profiles"."liquipedia_link", "lol_person_profiles"."liquipedia_sourced", NULL::text as "val_id", NULL::text as "esports_val_id", NULL::integer as "vlr_id", "lol_person_profiles"."lol_id" from "people" inner join "lol_person_profiles" on "lol_person_profiles"."person_id" = "people"."id");--> statement-breakpoint
CREATE VIEW "public"."val_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "val_person_profiles"."is_active", "val_person_profiles"."is_ghost", "val_person_profiles"."liquipedia_link", "val_person_profiles"."liquipedia_sourced", "val_person_profiles"."val_id", "val_person_profiles"."esports_val_id", "val_person_profiles"."vlr_id", NULL::text as "lol_id" from "people" inner join "val_person_profiles" on "val_person_profiles"."person_id" = "people"."id");
--> statement-breakpoint
CREATE TABLE "lol_leaguepedia_games" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tournament_id" bigint NOT NULL,
	"leaguepedia_game_id" text NOT NULL,
	"leaguepedia_match_id" text NOT NULL,
	"overview_page" text NOT NULL,
	"game_in_match" integer NOT NULL,
	"team1" text,
	"team2" text,
	"blue" text,
	"red" text,
	"winner" smallint,
	"played_at" timestamp with time zone,
	"riot_match_id" text,
	"riot_version" text,
	"has_data" boolean DEFAULT false NOT NULL,
	"is_remake" boolean DEFAULT false NOT NULL,
	"is_chronobreak" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lol_leaguepedia_games_leaguepedia_game_id_unique" UNIQUE("leaguepedia_game_id"),
	CONSTRAINT "lol_leaguepedia_games_winner_check" CHECK ("lol_leaguepedia_games"."winner" IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "lol_leaguepedia_tournaments" (
	"tournament_id" bigint PRIMARY KEY NOT NULL,
	"overview_page" text NOT NULL,
	"games_fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_api_sessions" (
	"service" text PRIMARY KEY NOT NULL,
	"cookie_encrypted" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lol_leaguepedia_games" ADD CONSTRAINT "lol_leaguepedia_games_tournament_id_lol_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."lol_tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_leaguepedia_tournaments" ADD CONSTRAINT "lol_leaguepedia_tournaments_tournament_id_lol_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."lol_tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lol_leaguepedia_games_tournament_id_idx" ON "lol_leaguepedia_games" USING btree ("tournament_id");--> statement-breakpoint
ALTER TABLE "lol_games" ADD COLUMN "role_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "lol_data_dragon_catalogs" (
	"version" text PRIMARY KEY NOT NULL,
	"champions" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
