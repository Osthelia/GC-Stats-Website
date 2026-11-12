-- One identity per person for every game: `people` (shared) + one profile per game. val_people / lol_people become read only views.
-- LoL content is still a project draft, so it is wiped instead of remapped. Valorant ids do not change.

-- Wipe LoL: foreign keys coming from outside the lol_* tables are dropped for the truncate and restored after.
CREATE TEMP TABLE "tmp_external_fks" ON COMMIT DROP AS
SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.confrelid
WHERE c.contype = 'f' AND t.relname LIKE 'lol\_%' AND c.conrelid::regclass::text NOT LIKE 'lol\_%';
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM "tmp_external_fks" LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'lol\_%' LOOP
    EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
  END LOOP;
END $$;
--> statement-breakpoint
UPDATE "users" SET "lol_team_id" = NULL, "lol_team_tag" = NULL;
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM "tmp_external_fks" LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, r.def);
  END LOOP;
END $$;
--> statement-breakpoint
DELETE FROM "logos" WHERE "game" = 'lol';
--> statement-breakpoint
DELETE FROM "forum_threads" WHERE "game" = 'lol';
--> statement-breakpoint
DELETE FROM "activity_log" WHERE "properties" ->> 'game' = 'lol';
--> statement-breakpoint

-- The Valorant people table becomes the shared one (ids kept, foreign keys follow the rename).
ALTER TABLE "val_people" RENAME TO "people";
--> statement-breakpoint
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT s.relname FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
    WHERE s.relkind = 'S' AND d.refobjid = 'people'::regclass AND s.relname LIKE 'val\_people\_%'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I RENAME TO %I', c.relname, substr(c.relname, 5));
  END LOOP;
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'people'::regclass AND conname LIKE 'val\_people\_%' LOOP
    EXECUTE format('ALTER TABLE people RENAME CONSTRAINT %I TO %I', c.conname, substr(c.conname, 5));
  END LOOP;
  FOR c IN SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'people' AND indexname LIKE 'val\_people\_%' LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', c.indexname, substr(c.indexname, 5));
  END LOOP;
END $$;
--> statement-breakpoint

-- Game profiles. A row means the person exists in that game.
CREATE TABLE "val_person_profiles" (
  "person_id" bigint PRIMARY KEY NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_ghost" boolean DEFAULT false NOT NULL,
  "liquipedia_link" text,
  "liquipedia_sourced" boolean DEFAULT false NOT NULL,
  "val_id" text,
  "esports_val_id" text,
  "vlr_id" integer,
  CONSTRAINT "val_person_profiles_val_id_unique" UNIQUE("val_id"),
  CONSTRAINT "val_person_profiles_esports_val_id_unique" UNIQUE("esports_val_id")
);
--> statement-breakpoint
CREATE TABLE "lol_person_profiles" (
  "person_id" bigint PRIMARY KEY NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_ghost" boolean DEFAULT false NOT NULL,
  "liquipedia_link" text,
  "liquipedia_sourced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO "val_person_profiles" ("person_id", "is_active", "is_ghost", "liquipedia_link", "liquipedia_sourced", "val_id", "esports_val_id", "vlr_id")
SELECT "id", "is_active", "is_ghost", "liquipedia_link", "liquipedia_sourced", "val_id", "esports_val_id", "vlr_id" FROM "people";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "is_active";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "is_ghost";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "liquipedia_link";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "liquipedia_sourced";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "val_id";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "esports_val_id";
--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "vlr_id";
--> statement-breakpoint
CREATE INDEX "people_handle_lower_idx" ON "people" USING btree (lower("handle"));
--> statement-breakpoint

-- lol_people goes away: its foreign keys (all tables are empty now) are pointed at the shared table.
CREATE TEMP TABLE "tmp_lol_people_fks" ON COMMIT DROP AS
SELECT c.conrelid::regclass::text AS tbl, c.conname, replace(pg_get_constraintdef(c.oid), 'REFERENCES lol_people(', 'REFERENCES people(') AS def
FROM pg_constraint c
WHERE c.contype = 'f' AND c.confrelid = 'lol_people'::regclass;
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM "tmp_lol_people_fks" LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
--> statement-breakpoint
DROP TABLE "lol_people";
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM "tmp_lol_people_fks" LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, r.def);
  END LOOP;
END $$;
--> statement-breakpoint

-- Read models, same columns the per game people tables had.
CREATE VIEW "val_people" AS
SELECT p."id", p."handle", p."aliases", p."first_name", p."last_name", p."country_code", p."secondary_country_code", p."pronouns", p."birth_date", p."bio", p."socials", p."user_id",
  pr."is_active", pr."is_ghost", pr."liquipedia_link", pr."liquipedia_sourced", pr."val_id", pr."esports_val_id", pr."vlr_id"
FROM "people" p
JOIN "val_person_profiles" pr ON pr."person_id" = p."id";
--> statement-breakpoint
CREATE VIEW "lol_people" AS
SELECT p."id", p."handle", p."aliases", p."first_name", p."last_name", p."country_code", p."secondary_country_code", p."pronouns", p."birth_date", p."bio", p."socials", p."user_id",
  pr."is_active", pr."is_ghost", pr."liquipedia_link", pr."liquipedia_sourced", NULL::text AS "val_id", NULL::text AS "esports_val_id", NULL::integer AS "vlr_id"
FROM "people" p
JOIN "lol_person_profiles" pr ON pr."person_id" = p."id";
--> statement-breakpoint

-- Person photos are shared by every game.
UPDATE "logos" SET "game" = NULL WHERE "entity_type" = 'person';
--> statement-breakpoint

DO $$
BEGIN
  IF (SELECT count(*) FROM "val_person_profiles") <> (SELECT count(*) FROM "people") THEN
    RAISE EXCEPTION 'every person must have a Valorant profile after the migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "logos" WHERE "entity_type" = 'person' AND "game" IS NOT NULL) THEN
    RAISE EXCEPTION 'person logos must be game independent';
  END IF;
END $$;
