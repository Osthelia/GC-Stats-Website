ALTER TABLE "organizations" ADD COLUMN "games" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
-- Backfill: games where the organization already has a team, a member or an organized tournament; the others are listed on every game.
UPDATE "organizations" o SET "games" = ARRAY_REMOVE(ARRAY[
  CASE WHEN EXISTS (SELECT 1 FROM "val_teams" x WHERE x.organization_id = o.id)
    OR EXISTS (SELECT 1 FROM "val_organization_memberships" x WHERE x.organization_id = o.id)
    OR EXISTS (SELECT 1 FROM "val_tournaments" x WHERE x.organizer_organization_id = o.id) THEN 'valorant' END,
  CASE WHEN EXISTS (SELECT 1 FROM "lol_teams" x WHERE x.organization_id = o.id)
    OR EXISTS (SELECT 1 FROM "lol_organization_memberships" x WHERE x.organization_id = o.id)
    OR EXISTS (SELECT 1 FROM "lol_tournaments" x WHERE x.organizer_organization_id = o.id) THEN 'lol' END
], NULL);
--> statement-breakpoint
UPDATE "organizations" SET "games" = ARRAY['valorant', 'lol'] WHERE cardinality("games") = 0;
