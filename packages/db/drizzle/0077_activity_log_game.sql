-- Team and player entries now record their game; everything logged before games existed is valorant.
-- Legacy rows may hold null or an empty array instead of an object.
UPDATE "activity_log"
SET "properties" = (CASE WHEN jsonb_typeof("properties") = 'object' THEN "properties" ELSE '{}'::jsonb END) || '{"game": "valorant"}'::jsonb
WHERE "subject_type" IN ('team', 'player') AND ("properties" IS NULL OR jsonb_typeof("properties") <> 'object' OR NOT "properties" ? 'game');
