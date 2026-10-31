-- Stages configured before the scoring rules changed keep the legacy rules (1), new ones get the current rules (2).
ALTER TABLE "pickem_stage_settings" ADD COLUMN "scoring_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pickem_stage_settings" ALTER COLUMN "scoring_version" SET DEFAULT 2;
