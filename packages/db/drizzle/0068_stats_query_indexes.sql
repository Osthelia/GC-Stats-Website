DROP INDEX IF EXISTS "map_round_damages_raw_map_round_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "map_round_kills_raw_map_round_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_player_stats_entrant_id_idx" ON "map_player_stats" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_player_stats_person_id_idx" ON "map_player_stats" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_round_damages_raw_map_round_id_attacker_idx" ON "map_round_damages_raw" USING btree ("map_round_id","attacker_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_round_kills_raw_map_round_id_time_ms_idx" ON "map_round_kills_raw" USING btree ("map_round_id","time_ms");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_round_player_loadouts_raw_person_id_idx" ON "map_round_player_loadouts_raw" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_round_player_loadouts_raw_entrant_id_idx" ON "map_round_player_loadouts_raw" USING btree ("entrant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_rounds_raw_atk_entrant_id_idx" ON "map_rounds_raw" USING btree ("atk_entrant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_rounds_raw_def_entrant_id_idx" ON "map_rounds_raw" USING btree ("def_entrant_id");
