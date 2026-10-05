CREATE INDEX "map_round_alive_states_raw_map_round_id_idx" ON "map_round_alive_states_raw" USING btree ("map_round_id");--> statement-breakpoint
CREATE INDEX "map_round_damages_raw_map_round_id_idx" ON "map_round_damages_raw" USING btree ("map_round_id");--> statement-breakpoint
CREATE INDEX "map_round_player_positions_raw_map_round_id_idx" ON "map_round_player_positions_raw" USING btree ("map_round_id");--> statement-breakpoint
CREATE INDEX "map_round_player_positions_raw_map_round_kill_id_idx" ON "map_round_player_positions_raw" USING btree ("map_round_kill_id");