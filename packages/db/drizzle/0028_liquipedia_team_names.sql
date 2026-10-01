CREATE TABLE "liquipedia_team_names" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquipedia_team_names_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "liquipedia_team_names" ADD CONSTRAINT "liquipedia_team_names_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "liquipedia_team_names_name_lower_unique" ON "liquipedia_team_names" USING btree (lower("name"));