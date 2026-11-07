CREATE TABLE "team_private_contacts" (
	"team_id" bigint PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_private_contacts" ADD CONSTRAINT "team_private_contacts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;