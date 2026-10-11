ALTER TABLE "roster_memberships" ADD COLUMN "has_left" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "roster_memberships" SET "has_left" = true WHERE NOT upper_inf("period");--> statement-breakpoint
ALTER TABLE "roster_memberships" DROP CONSTRAINT "roster_memberships_no_overlap";--> statement-breakpoint
ALTER TABLE "roster_memberships" ADD CONSTRAINT "roster_memberships_no_overlap"
  EXCLUDE USING gist (
    "person_id" WITH =,
    "team_id" WITH =,
    "role" WITH =,
    "period" WITH &&
  ) WHERE (NOT ("has_left" AND upper_inf("period")));
