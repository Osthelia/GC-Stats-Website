CREATE TYPE "public"."container_type" AS ENUM('bracket', 'group');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('active', 'qualified', 'eliminated');--> statement-breakpoint
CREATE TYPE "public"."match_result" AS ENUM('winner', 'loser');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'ready', 'live', 'completed');--> statement-breakpoint
CREATE TYPE "public"."seed_source" AS ENUM('seed', 'group_rank', 'bye', 'qualification');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('a', 'b');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('pending', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "api_key_reveals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_key_id" bigint NOT NULL,
	"token" text NOT NULL,
	"key_value_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"viewed_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	CONSTRAINT "api_key_reveals_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_name" text NOT NULL,
	"key_hash" char(64) NOT NULL,
	"rate_limit" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_key_id" bigint,
	"method" text NOT NULL,
	"endpoint" text NOT NULL,
	"status_code" smallint NOT NULL,
	"duration_ms" bigint NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authenticators" (
	"credential_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "authenticators_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id"),
	CONSTRAINT "authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"guard" text DEFAULT 'web' NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" bigint NOT NULL,
	"permission_id" bigint NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope_type" text DEFAULT 'global' NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role_id" bigint NOT NULL,
	"scope_id" bigint,
	CONSTRAINT "user_roles_user_role_scope_unique" UNIQUE NULLS NOT DISTINCT("user_id","role_id","scope_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"username" varchar(32),
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pronouns" smallint DEFAULT 2,
	"bio" text,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"team_tag" text,
	"data_explorer_enabled" boolean DEFAULT false NOT NULL,
	"discord_synced_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"two_factor_secret" text,
	"two_factor_recovery_codes" text,
	"two_factor_confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "bracket_edges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"from_match_id" bigint NOT NULL,
	"from_result" "match_result" NOT NULL,
	"to_match_id" bigint NOT NULL,
	"to_slot" "slot" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "container_standings_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"container_id" bigint NOT NULL,
	"criteria" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entrant_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entrant_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"is_starter" boolean DEFAULT true NOT NULL,
	CONSTRAINT "entrant_members_entrant_person_role_unique" UNIQUE("entrant_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "entrants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tournament_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"team_id" bigint,
	"player_id" bigint,
	"display_name" text NOT NULL,
	"seed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"container_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"seed" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"buchholz" integer DEFAULT 0 NOT NULL,
	"round_diff" integer DEFAULT 0 NOT NULL,
	"had_bye" boolean DEFAULT false NOT NULL,
	"status" "entry_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_seeds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"slot" "slot" NOT NULL,
	"source_type" "seed_source" NOT NULL,
	"source_ref" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_vetos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"map_name" text NOT NULL,
	"type" text NOT NULL,
	"order" integer NOT NULL,
	"side" char(3),
	"side_picked_by_entrant_id" bigint
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"container_id" bigint NOT NULL,
	"round" integer NOT NULL,
	"label" text,
	"best_of" integer DEFAULT 1 NOT NULL,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"entrant_a_id" bigint,
	"entrant_b_id" bigint,
	"score_a" integer,
	"score_b" integer,
	"winner_id" bigint,
	"scheduled_at" timestamp with time zone,
	"patch" text,
	"is_forfeit" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"point_type_id" bigint NOT NULL,
	"amount" integer NOT NULL,
	"qualification_result_id" bigint,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "point_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualification_results" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"qualification_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"rank" integer,
	CONSTRAINT "qualification_results_qualification_entrant_unique" UNIQUE("qualification_id","entrant_id")
);
--> statement-breakpoint
CREATE TABLE "stage_containers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stage_id" bigint NOT NULL,
	"name" text NOT NULL,
	"container_type" "container_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "stage_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_qualifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_container_id" bigint,
	"rank_from" integer,
	"rank_to" integer,
	"source_match_id" bigint,
	"outcome" "match_result",
	"destination_type" text NOT NULL,
	"destination_container_id" bigint,
	"placement" integer,
	"placement_label" text,
	"points" integer,
	"cash_prize_amount" numeric(12, 2),
	"cash_prize_currency" char(3)
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tournament_id" bigint NOT NULL,
	"name" text NOT NULL,
	"sequence_order" integer NOT NULL,
	"status" "stage_status" DEFAULT 'pending' NOT NULL,
	"start_date" date,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_components" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tournament_id" bigint NOT NULL,
	"kind" varchar(64) NOT NULL,
	"component_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"category" text,
	"prize_pool" text,
	"location" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"description" text,
	"active" boolean DEFAULT false NOT NULL,
	"liquipedia_links" text[] DEFAULT '{}' NOT NULL,
	"player_pov_phrase" text,
	"point_type_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_request_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"change_request_id" bigint NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"applied_at" timestamp with time zone,
	"apply_error" text
);
--> statement-breakpoint
CREATE TABLE "change_request_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"change_request_id" bigint NOT NULL,
	"user_id" text,
	"type" text DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" bigint NOT NULL,
	"requested_by" text,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"sanctioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_explorer_api_keys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"key_encrypted" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_validated_at" timestamp with time zone,
	"last_validation_status" text,
	CONSTRAINT "data_explorer_api_keys_user_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "data_explorer_error_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" text,
	"source" text NOT NULL,
	"request_payload" jsonb,
	"error_code" text,
	"error_message" text,
	"http_status" integer,
	CONSTRAINT "data_explorer_error_logs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "data_explorer_usages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"platform_requests_count" integer DEFAULT 0 NOT NULL,
	"personal_requests_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"image_path" text NOT NULL,
	"source" varchar(40) DEFAULT 'custom' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "emotes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "forum_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"thread_id" bigint NOT NULL,
	"user_id" text,
	"parent_id" bigint,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_threads" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"subject_type" text,
	"subject_id" bigint,
	"title" text,
	"created_by" text,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_suspects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text,
	"subject_type" text,
	"subject_id" bigint,
	"thread_id" bigint,
	"user_id" text,
	"matched_term" text,
	"body_snapshot" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"author_id" bigint,
	"publisher_id" bigint,
	"lang" char(5) DEFAULT 'fr' NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"image_cover" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"show_on_home" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "news_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_authors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "news_authors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"news_id" bigint,
	"author_id" bigint
);
--> statement-breakpoint
CREATE TABLE "news_publishers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_permissions" jsonb,
	CONSTRAINT "news_publishers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_relations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"news_id" bigint NOT NULL,
	"relatable_type" text NOT NULL,
	"relatable_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"emote_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"reactable_type" text NOT NULL,
	"reactable_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanction_identities" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sanction_id" bigint NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanctions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"team_id" bigint,
	"issued_by" text,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"transferred_from" bigint
);
--> statement-breakpoint
CREATE TABLE "user_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"reported_user_id" text,
	"reported_message_id" bigint,
	"reactable_type" text,
	"reactable_id" bigint,
	"emote_id" bigint,
	"organization_id" bigint,
	"category" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE "logos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"period" "tstzrange" NOT NULL,
	"theme" text,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"organization_id" bigint NOT NULL,
	"role" text NOT NULL,
	"period" daterange NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"country_code" char(3),
	"secondary_country_code" char(3),
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_permissions" jsonb,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
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
	"discord_id" text,
	"val_id" text,
	"esports_val_id" text,
	"vlr_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" text,
	"liquipedia_link" text,
	CONSTRAINT "people_discord_id_unique" UNIQUE("discord_id"),
	CONSTRAINT "people_val_id_unique" UNIQUE("val_id"),
	CONSTRAINT "people_esports_val_id_unique" UNIQUE("esports_val_id"),
	CONSTRAINT "people_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "production_credits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"organization_id" bigint,
	"role" text NOT NULL,
	"title_override" text,
	"tournament_id" bigint,
	"stage_id" bigint,
	"container_id" bigint,
	"match_id" bigint,
	"map_id" bigint
);
--> statement-breakpoint
CREATE TABLE "roster_memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"period" daterange NOT NULL,
	"inactive_since" date
);
--> statement-breakpoint
CREATE TABLE "team_name_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"name" text NOT NULL,
	"period" daterange NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" varchar(10),
	"country_code" char(3),
	"secondary_country_code" char(3),
	"socials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bio" text,
	"vlr_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_permissions" jsonb,
	"tags" jsonb,
	"liquipedia_link" text
);
--> statement-breakpoint
CREATE TABLE "map_player_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_id" bigint NOT NULL,
	"person_id" bigint,
	"entrant_id" bigint NOT NULL,
	"agent_name" text,
	"val_name" text,
	"kills" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"acs" integer DEFAULT 0 NOT NULL,
	"adr" integer DEFAULT 0 NOT NULL,
	"kast_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"first_kills" integer DEFAULT 0 NOT NULL,
	"first_deaths" integer DEFAULT 0 NOT NULL,
	"headshot_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"clutches" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"multikills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trade_kills" integer DEFAULT 0 NOT NULL,
	"traded_deaths" integer DEFAULT 0 NOT NULL,
	"round_type_splits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ability_kills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fall_deaths" integer DEFAULT 0 NOT NULL,
	"weapon_kills" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_round_alive_states_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_round_id" bigint NOT NULL,
	"sequence" smallint NOT NULL,
	"time_ms" integer NOT NULL,
	"atk_alive" smallint NOT NULL,
	"def_alive" smallint NOT NULL,
	"winner_side" text
);
--> statement-breakpoint
CREATE TABLE "map_round_damages_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_round_id" bigint NOT NULL,
	"attacker_person_id" bigint,
	"receiver_person_id" bigint NOT NULL,
	"damage" integer NOT NULL,
	"headshots" integer DEFAULT 0 NOT NULL,
	"bodyshots" integer DEFAULT 0 NOT NULL,
	"legshots" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_round_kills_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_round_id" bigint NOT NULL,
	"killer_person_id" bigint,
	"victim_person_id" bigint NOT NULL,
	"time_ms" integer NOT NULL,
	"weapon" text,
	"damage_type" text,
	"is_secondary_fire" boolean,
	"assistant_person_ids" bigint[]
);
--> statement-breakpoint
CREATE TABLE "map_round_player_loadouts_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_round_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"entrant_id" bigint,
	"kills" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"loadout_value" integer,
	"economy_spent" integer,
	"economy_remaining" integer,
	"weapon" text,
	"armor" text
);
--> statement-breakpoint
CREATE TABLE "map_round_player_positions_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_round_id" bigint NOT NULL,
	"map_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"map_round_kill_id" bigint,
	"person_id" bigint NOT NULL,
	"role" text,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"view_radians" real,
	"time_ms" integer
);
--> statement-breakpoint
CREATE TABLE "map_rounds_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_id" bigint NOT NULL,
	"round_number" integer NOT NULL,
	"winning_entrant_id" bigint,
	"win_type" text,
	"atk_entrant_id" bigint,
	"def_entrant_id" bigint,
	"plant_site" text,
	"plant_x" integer,
	"plant_y" integer,
	"plant_time_ms" integer
);
--> statement-breakpoint
CREATE TABLE "map_team_round_summary" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"map_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"side" text NOT NULL,
	"rounds_played" integer DEFAULT 0 NOT NULL,
	"rounds_won" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"api_match_id" text,
	"map_name" text,
	"game_mode" text,
	"team_a_score" integer,
	"team_b_score" integer,
	"order" integer NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"note" text,
	"is_forfeit" boolean DEFAULT false NOT NULL,
	CONSTRAINT "maps_api_match_id_unique" UNIQUE("api_match_id")
);
--> statement-breakpoint
CREATE TABLE "about_projects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" jsonb NOT NULL,
	"url" text,
	"logo_url" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "about_sections" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "about_sections_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"log_name" text,
	"description" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"event" text,
	"causer_type" text,
	"causer_id" bigint,
	"attribute_changes" jsonb,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"amount_usd" numeric(10, 2) NOT NULL,
	"amount_eur" numeric(10, 2) NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "match_player_povs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"person_id" bigint,
	"twitch_login" text NOT NULL,
	"title" text,
	"url" text NOT NULL,
	"last_seen_live_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_streams" (
	"match_id" bigint NOT NULL,
	"stream_channel_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"author_id" bigint,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"link" text,
	"data" jsonb,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"uri" text NOT NULL,
	"viewed_at" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"country_code" char(3) DEFAULT '' NOT NULL,
	"region_code" char(4) DEFAULT '' NOT NULL,
	CONSTRAINT "page_views_uri_viewed_at_region_code_country_code_pk" PRIMARY KEY("uri","viewed_at","region_code","country_code")
);
--> statement-breakpoint
CREATE TABLE "stream_channels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publisher_id" bigint,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"language_code" char(5) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" bigint NOT NULL,
	"map_id" bigint,
	"publisher_id" bigint,
	"url" text NOT NULL,
	"language_code" char(5) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_id_map" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"legacy_id" bigint NOT NULL,
	"new_id" bigint NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migration_id_map_entity_legacy_unique" UNIQUE("entity_type","legacy_id")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_reveals" ADD CONSTRAINT "api_key_reveals_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_log" ADD CONSTRAINT "api_request_log_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_edges" ADD CONSTRAINT "bracket_edges_from_match_id_matches_id_fk" FOREIGN KEY ("from_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_edges" ADD CONSTRAINT "bracket_edges_to_match_id_matches_id_fk" FOREIGN KEY ("to_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "container_standings_rules" ADD CONSTRAINT "container_standings_rules_container_id_stage_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrant_members" ADD CONSTRAINT "entrant_members_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrant_members" ADD CONSTRAINT "entrant_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_player_id_people_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_container_id_stage_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_seeds" ADD CONSTRAINT "match_seeds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_vetos" ADD CONSTRAINT "match_vetos_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_vetos" ADD CONSTRAINT "match_vetos_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_vetos" ADD CONSTRAINT "match_vetos_side_picked_by_entrant_id_entrants_id_fk" FOREIGN KEY ("side_picked_by_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_container_id_stage_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_entrant_a_id_entrants_id_fk" FOREIGN KEY ("entrant_a_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_entrant_b_id_entrants_id_fk" FOREIGN KEY ("entrant_b_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_entrants_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_point_type_id_point_types_id_fk" FOREIGN KEY ("point_type_id") REFERENCES "public"."point_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_qualification_result_id_qualification_results_id_fk" FOREIGN KEY ("qualification_result_id") REFERENCES "public"."qualification_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_results" ADD CONSTRAINT "qualification_results_qualification_id_stage_qualifications_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."stage_qualifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_results" ADD CONSTRAINT "qualification_results_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_containers" ADD CONSTRAINT "stage_containers_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_qualifications" ADD CONSTRAINT "stage_qualifications_source_container_id_stage_containers_id_fk" FOREIGN KEY ("source_container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_qualifications" ADD CONSTRAINT "stage_qualifications_source_match_id_matches_id_fk" FOREIGN KEY ("source_match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_qualifications" ADD CONSTRAINT "stage_qualifications_destination_container_id_stage_containers_id_fk" FOREIGN KEY ("destination_container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_components" ADD CONSTRAINT "tournament_components_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_point_type_id_point_types_id_fk" FOREIGN KEY ("point_type_id") REFERENCES "public"."point_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request_items" ADD CONSTRAINT "change_request_items_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request_items" ADD CONSTRAINT "change_request_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request_messages" ADD CONSTRAINT "change_request_messages_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_request_messages" ADD CONSTRAINT "change_request_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_explorer_api_keys" ADD CONSTRAINT "data_explorer_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_explorer_error_logs" ADD CONSTRAINT "data_explorer_error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_explorer_usages" ADD CONSTRAINT "data_explorer_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_messages" ADD CONSTRAINT "forum_messages_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_messages" ADD CONSTRAINT "forum_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_suspects" ADD CONSTRAINT "moderation_suspects_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_suspects" ADD CONSTRAINT "moderation_suspects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_suspects" ADD CONSTRAINT "moderation_suspects_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_news_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."news_authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_publisher_id_news_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."news_publishers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_authors" ADD CONSTRAINT "news_authors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_images" ADD CONSTRAINT "news_images_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_images" ADD CONSTRAINT "news_images_author_id_news_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."news_authors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_relations" ADD CONSTRAINT "news_relations_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_emote_id_emotes_id_fk" FOREIGN KEY ("emote_id") REFERENCES "public"."emotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanction_identities" ADD CONSTRAINT "sanction_identities_sanction_id_sanctions_id_fk" FOREIGN KEY ("sanction_id") REFERENCES "public"."sanctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reported_message_id_forum_messages_id_fk" FOREIGN KEY ("reported_message_id") REFERENCES "public"."forum_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_name_history" ADD CONSTRAINT "team_name_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD CONSTRAINT "map_player_stats_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD CONSTRAINT "map_player_stats_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD CONSTRAINT "map_player_stats_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_alive_states_raw" ADD CONSTRAINT "map_round_alive_states_raw_map_round_id_map_rounds_raw_id_fk" FOREIGN KEY ("map_round_id") REFERENCES "public"."map_rounds_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_damages_raw" ADD CONSTRAINT "map_round_damages_raw_map_round_id_map_rounds_raw_id_fk" FOREIGN KEY ("map_round_id") REFERENCES "public"."map_rounds_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_damages_raw" ADD CONSTRAINT "map_round_damages_raw_attacker_person_id_people_id_fk" FOREIGN KEY ("attacker_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_damages_raw" ADD CONSTRAINT "map_round_damages_raw_receiver_person_id_people_id_fk" FOREIGN KEY ("receiver_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_kills_raw" ADD CONSTRAINT "map_round_kills_raw_map_round_id_map_rounds_raw_id_fk" FOREIGN KEY ("map_round_id") REFERENCES "public"."map_rounds_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_kills_raw" ADD CONSTRAINT "map_round_kills_raw_killer_person_id_people_id_fk" FOREIGN KEY ("killer_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_kills_raw" ADD CONSTRAINT "map_round_kills_raw_victim_person_id_people_id_fk" FOREIGN KEY ("victim_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_loadouts_raw" ADD CONSTRAINT "map_round_player_loadouts_raw_map_round_id_map_rounds_raw_id_fk" FOREIGN KEY ("map_round_id") REFERENCES "public"."map_rounds_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_loadouts_raw" ADD CONSTRAINT "map_round_player_loadouts_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_loadouts_raw" ADD CONSTRAINT "map_round_player_loadouts_raw_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_positions_raw" ADD CONSTRAINT "map_round_player_positions_raw_map_round_id_map_rounds_raw_id_fk" FOREIGN KEY ("map_round_id") REFERENCES "public"."map_rounds_raw"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_positions_raw" ADD CONSTRAINT "map_round_player_positions_raw_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_positions_raw" ADD CONSTRAINT "map_round_player_positions_raw_map_round_kill_id_map_round_kills_raw_id_fk" FOREIGN KEY ("map_round_kill_id") REFERENCES "public"."map_round_kills_raw"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_round_player_positions_raw" ADD CONSTRAINT "map_round_player_positions_raw_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_rounds_raw" ADD CONSTRAINT "map_rounds_raw_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_rounds_raw" ADD CONSTRAINT "map_rounds_raw_winning_entrant_id_entrants_id_fk" FOREIGN KEY ("winning_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_rounds_raw" ADD CONSTRAINT "map_rounds_raw_atk_entrant_id_entrants_id_fk" FOREIGN KEY ("atk_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_rounds_raw" ADD CONSTRAINT "map_rounds_raw_def_entrant_id_entrants_id_fk" FOREIGN KEY ("def_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_team_round_summary" ADD CONSTRAINT "map_team_round_summary_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_team_round_summary" ADD CONSTRAINT "map_team_round_summary_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_povs" ADD CONSTRAINT "match_player_povs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_povs" ADD CONSTRAINT "match_player_povs_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_streams" ADD CONSTRAINT "match_streams_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_streams" ADD CONSTRAINT "match_streams_stream_channel_id_stream_channels_id_fk" FOREIGN KEY ("stream_channel_id") REFERENCES "public"."stream_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_channels" ADD CONSTRAINT "stream_channels_publisher_id_news_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."news_publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vods" ADD CONSTRAINT "vods_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vods" ADD CONSTRAINT "vods_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vods" ADD CONSTRAINT "vods_publisher_id_news_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."news_publishers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Postgres-native constraints/columns/indexes that Drizzle's schema builder can't
-- express (EXCLUDE, multi-column CHECK, GIN on array) or that were never modeled
-- in schema.ts (users.team_id). Carried over verbatim from the old 0001_constraints.sql
-- so this squashed baseline still reproduces the real database structure. See DATABASES.MD §8.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- users.team_id ("fan of" a team, NOT a roster membership) — never modeled in
-- schema/auth.ts to avoid a circular module dependency between schema/auth.ts
-- and schema/people.ts. Real column in the database, absent from the TS schema.
ALTER TABLE "users" ADD COLUMN "team_id" bigint REFERENCES "teams"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- entrants.kind discriminant — GC-Stats only ever writes 'team'/'placeholder',
-- 'player' reserved for a future BRACKT solo-game use (DATABASES.MD §2.3).
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_kind_check" CHECK (
  ("kind" = 'team' AND "team_id" IS NOT NULL AND "player_id" IS NULL) OR
  ("kind" = 'player' AND "player_id" IS NOT NULL AND "team_id" IS NULL) OR
  ("kind" = 'placeholder' AND "team_id" IS NULL AND "player_id" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_kind_allowed_check" CHECK (
  "kind" IN ('team', 'player', 'placeholder')
);
--> statement-breakpoint

-- stage_qualifications: exactly one source (a container's rank range, or a
-- match's winner/loser) — DATABASES.MD §2.6.
ALTER TABLE "stage_qualifications" ADD CONSTRAINT "stage_qualifications_source_check" CHECK (
  ("source_container_id" IS NOT NULL AND "source_match_id" IS NULL) OR
  ("source_container_id" IS NULL AND "source_match_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "stage_qualifications" ADD CONSTRAINT "stage_qualifications_destination_type_check" CHECK (
  "destination_type" IN ('container', 'placement')
);
--> statement-breakpoint

-- production_credits: exactly one scope level per credit — DATABASES.MD §3.2.
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_scope_check" CHECK (
  num_nonnulls("tournament_id", "stage_id", "container_id", "match_id", "map_id") = 1
);
--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_tournament_id_fkey"
  FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_stage_id_fkey"
  FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_container_id_fkey"
  FOREIGN KEY ("container_id") REFERENCES "stage_containers"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_match_id_fkey"
  FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "production_credits" ADD CONSTRAINT "production_credits_map_id_fkey"
  FOREIGN KEY ("map_id") REFERENCES "maps"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- roster_memberships: a person can hold two DIFFERENT roles concurrently in
-- the same team (e.g. player + interim coach), but not the same role twice
-- over overlapping periods — DATABASES.MD §3.2.
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_no_overlap"
  EXCLUDE USING gist (
    "person_id" WITH =,
    "team_id" WITH =,
    "role" WITH =,
    "period" WITH &&
  );
--> statement-breakpoint

-- organization_memberships: same anti-overlap rule, scoped to (person, org, role).
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_no_overlap"
  EXCLUDE USING gist (
    "person_id" WITH =,
    "organization_id" WITH =,
    "role" WITH =,
    "period" WITH &&
  );
--> statement-breakpoint

-- team_name_history: a team can't have two "current" names at once.
ALTER TABLE "team_name_history" ADD CONSTRAINT "team_name_history_no_overlap"
  EXCLUDE USING gist (
    "team_id" WITH =,
    "period" WITH &&
  );
--> statement-breakpoint

-- logos: same anti-overlap rule per (entity, theme) — a light-theme logo and
-- a dark-theme logo can be active at the same time, two light-theme ones can't.
ALTER TABLE "logos" ADD CONSTRAINT "logos_no_overlap"
  EXCLUDE USING gist (
    "entity_type" WITH =,
    "entity_id" WITH =,
    COALESCE("theme", '') WITH =,
    "period" WITH &&
  );
--> statement-breakpoint

-- organizations.tags — queried by tag (e.g. "all tournament organizers"),
-- GIN is the right index shape for a text[] containment/overlap query.
CREATE INDEX "organizations_tags_gin_idx" ON "organizations" USING gin ("tags");
--> statement-breakpoint

-- Query-pattern indexes carried over from the V1 migrations (DATABASES.MD's
-- "heavy denormalization... evaluate replacing with proper indexes" note —
-- this is that replacement for the hottest lookup paths).
CREATE INDEX "matches_container_round_idx" ON "matches" ("container_id", "round");
--> statement-breakpoint
CREATE INDEX "matches_scheduled_at_idx" ON "matches" ("scheduled_at");
--> statement-breakpoint
CREATE INDEX "map_round_player_positions_raw_map_id_idx" ON "map_round_player_positions_raw" ("map_id");
--> statement-breakpoint
CREATE INDEX "map_player_stats_entrant_id_idx" ON "map_player_stats" ("entrant_id");
--> statement-breakpoint
CREATE INDEX "map_player_stats_person_id_idx" ON "map_player_stats" ("person_id");
--> statement-breakpoint
CREATE INDEX "roster_memberships_team_id_idx" ON "roster_memberships" ("team_id");
--> statement-breakpoint
CREATE INDEX "roster_memberships_person_id_idx" ON "roster_memberships" ("person_id");
--> statement-breakpoint
CREATE INDEX "production_credits_person_id_idx" ON "production_credits" ("person_id");
