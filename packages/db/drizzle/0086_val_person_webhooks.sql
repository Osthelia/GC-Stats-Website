-- player.updated is a Valorant event: it follows the shared identity of the people who have a Valorant profile, and the profile itself.
CREATE OR REPLACE FUNCTION "gcs_webhook_person_trigger"() RETURNS trigger AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD AND EXISTS (SELECT 1 FROM "val_person_profiles" WHERE "person_id" = NEW."id") THEN
    PERFORM "gcs_webhook_enqueue"('player.updated', NEW."id");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "gcs_webhook_person_profile_trigger"() RETURNS trigger AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN
    PERFORM "gcs_webhook_enqueue"('player.updated', NEW."person_id");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "people_webhook" ON "people";--> statement-breakpoint
CREATE TRIGGER "people_webhook" AFTER UPDATE ON "people" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_person_trigger"();--> statement-breakpoint
CREATE TRIGGER "val_person_profiles_webhook" AFTER UPDATE ON "val_person_profiles" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_person_profile_trigger"();
