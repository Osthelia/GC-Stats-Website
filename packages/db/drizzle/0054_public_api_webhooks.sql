CREATE TABLE "webhook_deliveries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"endpoint_id" bigint NOT NULL,
	"event_type" text NOT NULL,
	"entity_id" bigint,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_status_code" smallint,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"api_key_id" bigint NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"secret_encrypted" text NOT NULL,
	"events" text[] NOT NULL,
	"filter_regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"filter_team_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
	"filter_official" text DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"disabled_reason" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "kind" text DEFAULT 'partner' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "usage_description" text;--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_id_created_at_idx" ON "webhook_deliveries" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("next_attempt_at") WHERE "webhook_deliveries"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "webhook_endpoints_api_key_id_idx" ON "webhook_endpoints" USING btree ("api_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_pending_unique" ON "webhook_events" USING btree ("event_type","entity_id") WHERE "webhook_events"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events" USING btree ("processed_at");--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_kind_check" CHECK ("kind" IN ('partner', 'public'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION "gcs_webhook_enqueue"(p_event_type text, p_entity_id bigint) RETURNS void AS $$
BEGIN
  -- Skips the outbox entirely while no endpoint listens to this event.
  IF NOT EXISTS (SELECT 1 FROM "webhook_endpoints" WHERE "is_active" AND p_event_type = ANY("events")) THEN
    RETURN;
  END IF;
  INSERT INTO "webhook_events" ("event_type", "entity_id") VALUES (p_event_type, p_entity_id)
  ON CONFLICT ("event_type", "entity_id") WHERE "processed_at" IS NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "gcs_webhook_row_trigger"() RETURNS trigger AS $$
DECLARE
  entity text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM "gcs_webhook_enqueue"(entity || '.created', NEW."id");
  ELSIF NEW IS DISTINCT FROM OLD THEN
    PERFORM "gcs_webhook_enqueue"(entity || '.updated', NEW."id");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "gcs_webhook_map_trigger"() RETURNS trigger AS $$
BEGIN
  -- A map score or status change is a change of its match.
  IF TG_OP = 'DELETE' THEN
    PERFORM "gcs_webhook_enqueue"('match.updated', OLD."match_id");
  ELSIF TG_OP = 'INSERT' OR NEW IS DISTINCT FROM OLD THEN
    PERFORM "gcs_webhook_enqueue"('match.updated', NEW."match_id");
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "tournaments_webhook" AFTER INSERT OR UPDATE ON "tournaments" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_row_trigger"('tournament');--> statement-breakpoint
CREATE TRIGGER "matches_webhook" AFTER INSERT OR UPDATE ON "matches" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_row_trigger"('match');--> statement-breakpoint
CREATE TRIGGER "teams_webhook" AFTER UPDATE ON "teams" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_row_trigger"('team');--> statement-breakpoint
CREATE TRIGGER "people_webhook" AFTER UPDATE ON "people" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_row_trigger"('player');--> statement-breakpoint
CREATE TRIGGER "maps_webhook" AFTER INSERT OR UPDATE OR DELETE ON "maps" FOR EACH ROW EXECUTE FUNCTION "gcs_webhook_map_trigger"();
