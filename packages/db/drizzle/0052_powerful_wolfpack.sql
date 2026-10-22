CREATE TABLE "people" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"aliases" jsonb,
	"first_name" text,
	"last_name" text,
	"country_code" char(3),
	"secondary_country_code" char(3),
	"pronouns" smallint,
	"birth_date" date,
	"bio" text,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" text,
	CONSTRAINT "people_user_id_unique" UNIQUE("user_id")
);
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
	"champion_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"damage_stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
	"summoners" jsonb DEFAULT '[]'::jsonb NOT NULL
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
	CONSTRAINT "lol_game_team_stats_game_side_unique" UNIQUE("game_id","side")
);
--> statement-breakpoint
CREATE TABLE "lol_games" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"order" integer NOT NULL,
	"api_match_id" text,
	"platform_id" text,
	"patch" text,
	"started_at" timestamp with time zone,
	"duration_seconds" integer,
	"winner_entrant_id" bigint,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "lol_games_api_match_id_unique" UNIQUE("api_match_id"),
	CONSTRAINT "lol_games_match_id_order_unique" UNIQUE("match_id","order")
);
--> statement-breakpoint
CREATE TABLE "lol_person_profiles" (
	"person_id" bigint PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_ghost" boolean DEFAULT false NOT NULL,
	"liquipedia_link" text,
	"liquipedia_sourced" boolean DEFAULT false NOT NULL,
	"lol_id" text,
	CONSTRAINT "lol_person_profiles_lol_id_unique" UNIQUE("lol_id")
);
--> statement-breakpoint
CREATE TABLE "val_person_profiles" (
	"person_id" bigint PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_ghost" boolean DEFAULT false NOT NULL,
	"liquipedia_link" text,
	"liquipedia_sourced" boolean DEFAULT false NOT NULL,
	"val_id" text,
	"esports_val_id" text,
	"vlr_id" integer,
	CONSTRAINT "val_person_profiles_val_id_unique" UNIQUE("val_id"),
	CONSTRAINT "val_person_profiles_esports_val_id_unique" UNIQUE("esports_val_id")
);
--> statement-breakpoint
ALTER TABLE "lol_people" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "val_people" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "lol_people" CASCADE;--> statement-breakpoint
DROP TABLE "val_people" CASCADE;--> statement-breakpoint
ALTER TABLE "lol_entrant_members" DROP CONSTRAINT "lol_entrant_members_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_entrants" DROP CONSTRAINT "lol_entrants_player_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_liquipedia_person_names" DROP CONSTRAINT "lol_liquipedia_person_names_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_match_player_povs" DROP CONSTRAINT "lol_match_player_povs_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_organization_memberships" DROP CONSTRAINT "lol_organization_memberships_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_production_credits" DROP CONSTRAINT "lol_production_credits_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "lol_roster_memberships" DROP CONSTRAINT "lol_roster_memberships_person_id_lol_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_entrant_members" DROP CONSTRAINT "val_entrant_members_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_entrants" DROP CONSTRAINT "val_entrants_player_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_liquipedia_person_names" DROP CONSTRAINT "val_liquipedia_person_names_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_player_stats" DROP CONSTRAINT "val_map_player_stats_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_damages_raw" DROP CONSTRAINT "val_map_round_damages_raw_attacker_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_damages_raw" DROP CONSTRAINT "val_map_round_damages_raw_receiver_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_kills_raw" DROP CONSTRAINT "val_map_round_kills_raw_killer_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_kills_raw" DROP CONSTRAINT "val_map_round_kills_raw_victim_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_player_loadouts_raw" DROP CONSTRAINT "val_map_round_player_loadouts_raw_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_map_round_player_positions_raw" DROP CONSTRAINT "val_map_round_player_positions_raw_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_match_player_povs" DROP CONSTRAINT "val_match_player_povs_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_organization_memberships" DROP CONSTRAINT "val_organization_memberships_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_production_credits" DROP CONSTRAINT "val_production_credits_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "val_roster_memberships" DROP CONSTRAINT "val_roster_memberships_person_id_val_people_id_fk";
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "lol_person_profiles" ADD CONSTRAINT "lol_person_profiles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_person_profiles" ADD CONSTRAINT "val_person_profiles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_handle_lower_idx" ON "people" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "lol_game_player_stats_entrant_id_idx" ON "lol_game_player_stats" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX "lol_game_player_stats_person_id_idx" ON "lol_game_player_stats" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "lol_game_team_stats_entrant_id_idx" ON "lol_game_team_stats" USING btree ("entrant_id");--> statement-breakpoint
ALTER TABLE "lol_entrant_members" ADD CONSTRAINT "lol_entrant_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_entrants" ADD CONSTRAINT "lol_entrants_player_id_people_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_liquipedia_person_names" ADD CONSTRAINT "lol_liquipedia_person_names_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_match_player_povs" ADD CONSTRAINT "lol_match_player_povs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_organization_memberships" ADD CONSTRAINT "lol_organization_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_production_credits" ADD CONSTRAINT "lol_production_credits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_roster_memberships" ADD CONSTRAINT "lol_roster_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lol_vods" ADD CONSTRAINT "lol_vods_map_id_lol_games_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."lol_games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_entrant_members" ADD CONSTRAINT "val_entrant_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_entrants" ADD CONSTRAINT "val_entrants_player_id_people_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_liquipedia_person_names" ADD CONSTRAINT "val_liquipedia_person_names_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_player_stats" ADD CONSTRAINT "val_map_player_stats_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_damages_raw" ADD CONSTRAINT "val_map_round_damages_raw_attacker_person_id_people_id_fk" FOREIGN KEY ("attacker_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_damages_raw" ADD CONSTRAINT "val_map_round_damages_raw_receiver_person_id_people_id_fk" FOREIGN KEY ("receiver_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_kills_raw" ADD CONSTRAINT "val_map_round_kills_raw_killer_person_id_people_id_fk" FOREIGN KEY ("killer_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_kills_raw" ADD CONSTRAINT "val_map_round_kills_raw_victim_person_id_people_id_fk" FOREIGN KEY ("victim_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_player_loadouts_raw" ADD CONSTRAINT "val_map_round_player_loadouts_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_map_round_player_positions_raw" ADD CONSTRAINT "val_map_round_player_positions_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_match_player_povs" ADD CONSTRAINT "val_match_player_povs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_organization_memberships" ADD CONSTRAINT "val_organization_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_production_credits" ADD CONSTRAINT "val_production_credits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "val_roster_memberships" ADD CONSTRAINT "val_roster_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."lol_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "lol_person_profiles"."is_active", "lol_person_profiles"."is_ghost", "lol_person_profiles"."liquipedia_link", "lol_person_profiles"."liquipedia_sourced", NULL::text as "val_id", NULL::text as "esports_val_id", NULL::integer as "vlr_id", "lol_person_profiles"."lol_id" from "people" inner join "lol_person_profiles" on "lol_person_profiles"."person_id" = "people"."id");--> statement-breakpoint
CREATE VIEW "public"."val_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "val_person_profiles"."is_active", "val_person_profiles"."is_ghost", "val_person_profiles"."liquipedia_link", "val_person_profiles"."liquipedia_sourced", "val_person_profiles"."val_id", "val_person_profiles"."esports_val_id", "val_person_profiles"."vlr_id", NULL::text as "lol_id" from "people" inner join "val_person_profiles" on "val_person_profiles"."person_id" = "people"."id");