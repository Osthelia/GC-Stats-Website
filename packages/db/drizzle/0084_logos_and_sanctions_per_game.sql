-- Team and tournament ids are counted per game since 0074, so the same id can be a Valorant and a League team. Two
-- shared tables still told them apart by id alone. Every statement can run again, so a database that ran an earlier
-- version of this migration (0084_logos_no_overlap_per_game) gets the rest without errors.

-- Logos: the overlap rule (one logo per entity and theme at a time) needs the game too, or a League team's logo
-- collides with the logo of the Valorant team with the same id. Person and organization logos have no game ('').
ALTER TABLE "logos" DROP CONSTRAINT IF EXISTS "logos_no_overlap";--> statement-breakpoint
ALTER TABLE "logos" ADD CONSTRAINT "logos_no_overlap"
  EXCLUDE USING gist (
    COALESCE("game", '') WITH =,
    "entity_type" WITH =,
    "entity_id" WITH =,
    COALESCE("theme", '') WITH =,
    "period" WITH &&
  );--> statement-breakpoint

-- Sanctions: a team sanction stores its team's game. Every team sanction so far came from the old site's data or the
-- Valorant-only dialog, so they are Valorant's.
ALTER TABLE "sanctions" ADD COLUMN IF NOT EXISTS "game" text;--> statement-breakpoint
UPDATE "sanctions" SET "game" = 'valorant' WHERE "team_id" IS NOT NULL AND "game" IS NULL;--> statement-breakpoint
ALTER TABLE "sanctions" DROP CONSTRAINT IF EXISTS "sanctions_team_game_check";--> statement-breakpoint
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_team_game_check" CHECK (("sanctions"."team_id" IS NULL) = ("sanctions"."game" IS NULL));
