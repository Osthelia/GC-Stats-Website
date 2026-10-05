ALTER TABLE "stage_containers" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "stage_containers" sc SET "display_order" = ranked.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "stage_id" ORDER BY (lower(btrim("name")) LIKE 'lower%'), "id") AS rn
  FROM "stage_containers"
) ranked
WHERE sc."id" = ranked."id";
