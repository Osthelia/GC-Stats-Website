-- The visitor country moves out of the app (global visit monitoring tool): page_views keeps one row per page and day.
-- Existing rows are summed over countries and regions first, the new primary key would otherwise collide. Everything runs in
-- the migration's transaction, so the temporary table disappears with it.
CREATE TEMP TABLE "page_views_agg" ON COMMIT DROP AS SELECT "uri", "viewed_at", SUM("count")::integer AS "count" FROM "page_views" GROUP BY "uri", "viewed_at";--> statement-breakpoint
DELETE FROM "page_views";--> statement-breakpoint
ALTER TABLE "page_views" DROP CONSTRAINT "page_views_uri_viewed_at_region_code_country_code_pk";--> statement-breakpoint
ALTER TABLE "page_views" DROP COLUMN "country_code";--> statement-breakpoint
ALTER TABLE "page_views" DROP COLUMN "region_code";--> statement-breakpoint
INSERT INTO "page_views" ("uri", "viewed_at", "count") SELECT "uri", "viewed_at", "count" FROM "page_views_agg";--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_uri_viewed_at_pk" PRIMARY KEY("uri","viewed_at");
