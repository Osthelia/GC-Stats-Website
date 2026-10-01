CREATE TYPE "public"."pickem_reward_kind" AS ENUM('top1pct', 'top5pct', 'perfect');--> statement-breakpoint
CREATE TYPE "public"."pickem_scoring_mode" AS ENUM('default', 'custom');--> statement-breakpoint
CREATE TABLE "pickem_group_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_group_members_group_user_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "pickem_group_phase_points" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"stage_id" bigint NOT NULL,
	"team_correct_points" integer NOT NULL,
	"outcome_correct_points" integer NOT NULL,
	"advancement_per_round_points" integer NOT NULL,
	"standing_rank_points" integer NOT NULL,
	CONSTRAINT "pickem_group_phase_points_group_stage_unique" UNIQUE("group_id","stage_id")
);
--> statement-breakpoint
CREATE TABLE "pickem_groups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tournament_id" bigint NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"scoring_mode" "pickem_scoring_mode" DEFAULT 'default' NOT NULL,
	"join_code" varchar(12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_groups_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "pickem_match_picks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" bigint NOT NULL,
	"match_id" bigint NOT NULL,
	"predicted_winner_entrant_id" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_match_picks_user_match_unique" UNIQUE("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "pickem_rewards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" bigint NOT NULL,
	"kind" "pickem_reward_kind" NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_rewards_user_stage_kind_unique" UNIQUE("user_id","stage_id","kind")
);
--> statement-breakpoint
CREATE TABLE "pickem_stage_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stage_id" bigint NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pickem_stage_settings_stage_unique" UNIQUE("stage_id")
);
--> statement-breakpoint
CREATE TABLE "pickem_standing_picks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" bigint NOT NULL,
	"container_id" bigint NOT NULL,
	"entrant_id" bigint NOT NULL,
	"predicted_rank" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickem_standing_picks_user_container_entrant_unique" UNIQUE("user_id","container_id","entrant_id"),
	CONSTRAINT "pickem_standing_picks_user_container_rank_unique" UNIQUE("user_id","container_id","predicted_rank")
);
--> statement-breakpoint
ALTER TABLE "pickem_group_members" ADD CONSTRAINT "pickem_group_members_group_id_pickem_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."pickem_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_group_members" ADD CONSTRAINT "pickem_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_group_phase_points" ADD CONSTRAINT "pickem_group_phase_points_group_id_pickem_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."pickem_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_group_phase_points" ADD CONSTRAINT "pickem_group_phase_points_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_groups" ADD CONSTRAINT "pickem_groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_groups" ADD CONSTRAINT "pickem_groups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_match_picks" ADD CONSTRAINT "pickem_match_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_match_picks" ADD CONSTRAINT "pickem_match_picks_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_match_picks" ADD CONSTRAINT "pickem_match_picks_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_match_picks" ADD CONSTRAINT "pickem_match_picks_predicted_winner_entrant_id_entrants_id_fk" FOREIGN KEY ("predicted_winner_entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_rewards" ADD CONSTRAINT "pickem_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_rewards" ADD CONSTRAINT "pickem_rewards_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_stage_settings" ADD CONSTRAINT "pickem_stage_settings_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_standing_picks" ADD CONSTRAINT "pickem_standing_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_standing_picks" ADD CONSTRAINT "pickem_standing_picks_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_standing_picks" ADD CONSTRAINT "pickem_standing_picks_container_id_stage_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."stage_containers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickem_standing_picks" ADD CONSTRAINT "pickem_standing_picks_entrant_id_entrants_id_fk" FOREIGN KEY ("entrant_id") REFERENCES "public"."entrants"("id") ON DELETE cascade ON UPDATE no action;