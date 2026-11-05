CREATE TYPE "public"."pickem_group_pick_mode" AS ENUM('standings', 'matches');--> statement-breakpoint
ALTER TABLE "pickem_group_phase_points" ADD COLUMN "group_match_points" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "pickem_stage_settings" ADD COLUMN "group_pick_mode" "pickem_group_pick_mode" DEFAULT 'standings' NOT NULL;