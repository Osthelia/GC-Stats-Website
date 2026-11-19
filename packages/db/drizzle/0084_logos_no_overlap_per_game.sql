-- Team and tournament ids are counted per game since 0074, so a League team and a Valorant team can share an id. The
-- overlap rule of the logos (one logo per entity and theme at a time) needs the game too, or a League team's logo
-- collides with the logo of the Valorant team with the same id. Person and organization logos have no game ('').
ALTER TABLE "logos" DROP CONSTRAINT IF EXISTS "logos_no_overlap";--> statement-breakpoint
ALTER TABLE "logos" ADD CONSTRAINT "logos_no_overlap"
  EXCLUDE USING gist (
    COALESCE("game", '') WITH =,
    "entity_type" WITH =,
    "entity_id" WITH =,
    COALESCE("theme", '') WITH =,
    "period" WITH &&
  );
