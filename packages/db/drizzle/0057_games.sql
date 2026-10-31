-- One copy of the content tables per game: existing tables become val_*, lol_* start empty.
DO $$
DECLARE
  t text;
  c record;
  all_tables text[] := ARRAY['teams', 'liquipedia_team_names', 'team_name_history', 'people', 'liquipedia_person_names', 'roster_memberships', 'organization_memberships', 'production_credits', 'point_types', 'tournaments', 'tournament_components', 'stages', 'stage_containers', 'entrants', 'entrant_members', 'group_entries', 'container_standings_rules', 'matches', 'match_seeds', 'bracket_edges', 'stage_qualifications', 'qualification_results', 'point_entries', 'news', 'news_messages', 'news_relations', 'news_images', 'change_requests', 'change_request_items', 'change_request_messages', 'change_request_discord_notices', 'stream_channels', 'match_streams', 'vods', 'match_player_povs', 'pickem_stage_settings', 'pickem_groups', 'pickem_group_members', 'pickem_group_phase_points', 'pickem_match_picks', 'pickem_standing_picks', 'pickem_rewards', 'maps', 'map_rounds_raw', 'map_round_kills_raw', 'map_round_damages_raw', 'map_round_alive_states_raw', 'map_round_player_positions_raw', 'map_round_player_loadouts_raw', 'map_player_stats', 'map_team_round_summary', 'match_vetos', 'tournament_veto_settings', 'match_veto_sessions'];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('ALTER TABLE %I RENAME TO %I', t, 'val_' || t);
    FOR c IN
      SELECT s.relname FROM pg_class s
      JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
      WHERE s.relkind = 'S' AND d.refobjid = ('val_' || t)::regclass
    LOOP
      IF c.relname LIKE t || '_%' THEN
        EXECUTE format('ALTER SEQUENCE %I RENAME TO %I', c.relname, left('val_' || c.relname, 63));
      END IF;
    END LOOP;
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = ('val_' || t)::regclass LOOP
      IF c.conname LIKE t || '_%' THEN
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 'val_' || t, c.conname, left('val_' || c.conname, 63));
      END IF;
    END LOOP;
    FOR c IN SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'val_' || t LOOP
      IF c.indexname LIKE t || '_%' THEN
        EXECUTE format('ALTER INDEX %I RENAME TO %I', c.indexname, left('val_' || c.indexname, 63));
      END IF;
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
  c record;
  game_tables text[] := ARRAY['teams', 'liquipedia_team_names', 'team_name_history', 'people', 'liquipedia_person_names', 'roster_memberships', 'organization_memberships', 'production_credits', 'point_types', 'tournaments', 'tournament_components', 'stages', 'stage_containers', 'entrants', 'entrant_members', 'group_entries', 'container_standings_rules', 'matches', 'match_seeds', 'bracket_edges', 'stage_qualifications', 'qualification_results', 'point_entries', 'news', 'news_messages', 'news_relations', 'news_images', 'change_requests', 'change_request_items', 'change_request_messages', 'change_request_discord_notices', 'stream_channels', 'match_streams', 'vods', 'match_player_povs', 'pickem_stage_settings', 'pickem_groups', 'pickem_group_members', 'pickem_group_phase_points', 'pickem_match_picks', 'pickem_standing_picks', 'pickem_rewards'];
BEGIN
  FOREACH t IN ARRAY game_tables LOOP
    EXECUTE format('CREATE TABLE %I (LIKE %I INCLUDING ALL)', 'lol_' || t, 'val_' || t);
    FOR c IN
      SELECT a.attname, left('lol_' || t || '_' || a.attname || '_seq', 63) AS seq
      FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE d.adrelid = ('lol_' || t)::regclass AND pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%'
    LOOP
      EXECUTE format('CREATE SEQUENCE %I OWNED BY %I.%I', c.seq, 'lol_' || t, c.attname);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT nextval(%L)', 'lol_' || t, c.attname, c.seq);
    END LOOP;
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = ('lol_' || t)::regclass AND conname LIKE 'val_%' LOOP
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 'lol_' || t, c.conname, 'lol_' || substr(c.conname, 5));
    END LOOP;
  END LOOP;
  FOREACH t IN ARRAY game_tables LOOP
    FOR c IN
      SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = ('val_' || t)::regclass AND contype = 'f'
    LOOP
      IF c.def LIKE '%REFERENCES val_%' THEN
        IF to_regclass(replace(substring(c.def from 'REFERENCES (val_[a-z_0-9]+)'), 'val_', 'lol_')) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', 'lol_' || t, 'lol_' || substr(c.conname, 5), replace(c.def, 'REFERENCES val_', 'REFERENCES lol_'));
      ELSE
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', 'lol_' || t, 'lol_' || substr(c.conname, 5), c.def);
      END IF;
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "logos" ADD COLUMN "game" text;
--> statement-breakpoint
UPDATE "logos" SET "game" = 'valorant' WHERE "entity_type" IN ('team', 'person', 'tournament');
--> statement-breakpoint
DROP INDEX "logos_entity_idx";
--> statement-breakpoint
CREATE INDEX "logos_entity_idx" ON "logos" USING btree ("game","entity_type","entity_id");
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD COLUMN "game" text;
--> statement-breakpoint
UPDATE "forum_threads" SET "game" = 'valorant' WHERE "subject_type" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "forum_threads" DROP CONSTRAINT "forum_threads_subject_unique";
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_subject_unique" UNIQUE("game","subject_type","subject_id");
--> statement-breakpoint
ALTER TABLE "user_roles" ADD COLUMN "game" text;
--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_role_scope_unique";
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_role_scope_unique" UNIQUE NULLS NOT DISTINCT("user_id","role_id","scope_id","game");
