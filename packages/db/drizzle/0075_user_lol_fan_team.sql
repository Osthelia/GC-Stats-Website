-- Fan team per game: users.team_id / team_tag stay the Valorant one, LoL gets its own pair.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lol_team_id" bigint REFERENCES "lol_teams"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lol_team_tag" text;
