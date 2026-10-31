CREATE TABLE "site_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "site_config" ADD CONSTRAINT "site_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "opendata_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dataset" text NOT NULL,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"status_code" smallint NOT NULL,
	"duration_ms" integer NOT NULL,
	"queue_ms" integer DEFAULT 0 NOT NULL,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"user_id" text,
	"client_hash" char(16) NOT NULL,
	"pressure" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opendata_request_log" ADD CONSTRAINT "opendata_request_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opendata_request_log_created_at_idx" ON "opendata_request_log" USING btree ("created_at");--> statement-breakpoint
CREATE TABLE "opendata_pressure_samples" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"instance" text NOT NULL,
	"pressure" text NOT NULL,
	"event_loop_lag_ms" integer NOT NULL,
	"db_pool_total" smallint NOT NULL,
	"db_pool_waiting" smallint NOT NULL,
	"in_flight" smallint NOT NULL,
	"queued" smallint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "opendata_pressure_samples_sampled_at_idx" ON "opendata_pressure_samples" USING btree ("sampled_at");
--> statement-breakpoint
INSERT INTO "permissions" ("name") VALUES ('settings.view'), ('settings.manage') ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE r."is_super_admin" AND p."name" IN ('settings.view', 'settings.manage')
ON CONFLICT DO NOTHING;
