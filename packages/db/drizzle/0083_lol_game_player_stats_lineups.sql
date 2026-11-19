ALTER TABLE "lol_game_player_stats" ALTER COLUMN "champion_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ALTER COLUMN "gold" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ALTER COLUMN "damage" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ALTER COLUMN "vision" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lol_data_dragon_catalogs" ADD COLUMN IF NOT EXISTS "summoners" jsonb;--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ADD COLUMN IF NOT EXISTS "has_stats" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lol_game_player_stats_game_person_unique') THEN
    ALTER TABLE "lol_game_player_stats" ADD CONSTRAINT "lol_game_player_stats_game_person_unique" UNIQUE("game_id","person_id");
  END IF;
END $$;