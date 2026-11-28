CREATE TABLE "lol_roster_membership_lanes" (
	"roster_membership_id" bigint NOT NULL,
	"lane" text NOT NULL,
	CONSTRAINT "lol_roster_membership_lanes_roster_membership_id_lane_pk" PRIMARY KEY("roster_membership_id","lane"),
	CONSTRAINT "lol_roster_membership_lanes_lane_check" CHECK ("lol_roster_membership_lanes"."lane" IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'))
);
--> statement-breakpoint
ALTER TABLE "lol_roster_membership_lanes" ADD CONSTRAINT "lol_roster_membership_lanes_roster_membership_id_lol_roster_memberships_id_fk" FOREIGN KEY ("roster_membership_id") REFERENCES "public"."lol_roster_memberships"("id") ON DELETE cascade ON UPDATE no action;