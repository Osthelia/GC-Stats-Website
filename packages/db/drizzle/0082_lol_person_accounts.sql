CREATE TABLE "lol_person_accounts" (
	"puuid" text PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"platform" text,
	"cluster" text,
	"riot_id" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "lol_person_accounts_cluster_check" CHECK ("lol_person_accounts"."cluster" IS NULL OR "lol_person_accounts"."cluster" IN ('americas', 'europe', 'asia', 'sea')),
	CONSTRAINT "lol_person_accounts_source_check" CHECK ("lol_person_accounts"."source" IN ('leaguepedia', 'riot', 'admin'))
);
--> statement-breakpoint
DROP VIEW "public"."lol_people";--> statement-breakpoint
DROP VIEW "public"."val_people";--> statement-breakpoint
ALTER TABLE "lol_person_profiles" DROP CONSTRAINT "lol_person_profiles_lol_id_unique";--> statement-breakpoint
ALTER TABLE "lol_person_accounts" ADD CONSTRAINT "lol_person_accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lol_person_accounts_person_id_idx" ON "lol_person_accounts" USING btree ("person_id");--> statement-breakpoint
-- Every existing lol_id becomes an account of its person. Platform, source and last_seen_at come from the person's
-- latest stored game (a person had one account, so every game they have was played with it). riot_id stays null: the
-- Riot ID is only in the raw match JSON in the imports bucket, and the next import of the account fills it.
-- The cluster is the platform's routing cluster (CLUSTER_BY_PLATFORM in lol-stats-engine/match-id.ts), null for the
-- tournament realm (LOLTMNT...) and for an account without games.
INSERT INTO "lol_person_accounts" ("puuid", "person_id", "platform", "cluster", "riot_id", "source", "created_at", "last_seen_at")
SELECT
	p."lol_id",
	p."person_id",
	latest."platform",
	CASE latest."platform"
		WHEN 'NA1' THEN 'americas' WHEN 'BR1' THEN 'americas' WHEN 'LA1' THEN 'americas' WHEN 'LA2' THEN 'americas'
		WHEN 'EUW1' THEN 'europe' WHEN 'EUN1' THEN 'europe' WHEN 'TR1' THEN 'europe' WHEN 'RU' THEN 'europe' WHEN 'ME1' THEN 'europe'
		WHEN 'KR' THEN 'asia' WHEN 'JP1' THEN 'asia'
		WHEN 'OC1' THEN 'sea' WHEN 'PH2' THEN 'sea' WHEN 'SG2' THEN 'sea' WHEN 'TH2' THEN 'sea' WHEN 'TW2' THEN 'sea' WHEN 'VN2' THEN 'sea'
		ELSE NULL
	END,
	NULL,
	COALESCE(latest."source", 'leaguepedia'),
	now(),
	latest."started_at"
FROM "lol_person_profiles" p
LEFT JOIN LATERAL (
	SELECT COALESCE(g."platform_id", NULLIF(split_part(g."api_match_id", '_', 1), '')) AS "platform", g."source", g."started_at"
	FROM "lol_game_player_stats" s
	INNER JOIN "lol_games" g ON g."id" = s."game_id"
	WHERE s."person_id" = p."person_id"
	ORDER BY g."started_at" DESC NULLS LAST, g."id" DESC
	LIMIT 1
) latest ON true
WHERE p."lol_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "lol_person_profiles" DROP COLUMN "lol_id";--> statement-breakpoint
CREATE VIEW "public"."lol_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "lol_person_profiles"."is_active", "lol_person_profiles"."is_ghost", "lol_person_profiles"."liquipedia_link", "lol_person_profiles"."liquipedia_sourced", NULL::text as "val_id", NULL::text as "esports_val_id", NULL::integer as "vlr_id" from "people" inner join "lol_person_profiles" on "lol_person_profiles"."person_id" = "people"."id");--> statement-breakpoint
CREATE VIEW "public"."val_people" AS (select "people"."id", "people"."handle", "people"."aliases", "people"."first_name", "people"."last_name", "people"."country_code", "people"."secondary_country_code", "people"."pronouns", "people"."birth_date", "people"."bio", "people"."socials", "people"."user_id", "val_person_profiles"."is_active", "val_person_profiles"."is_ghost", "val_person_profiles"."liquipedia_link", "val_person_profiles"."liquipedia_sourced", "val_person_profiles"."val_id", "val_person_profiles"."esports_val_id", "val_person_profiles"."vlr_id" from "people" inner join "val_person_profiles" on "val_person_profiles"."person_id" = "people"."id");
--> statement-breakpoint
ALTER TABLE "lol_game_player_stats" ADD COLUMN "role_bound_item" integer;