CREATE TABLE "team_info_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text NOT NULL,
	"contact_kind" text NOT NULL,
	"contact_channel" text NOT NULL,
	"contact_value" text NOT NULL,
	"contact_label" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "team_info_requests" ADD CONSTRAINT "team_info_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_info_requests" ADD CONSTRAINT "team_info_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_info_requests_team_id_idx" ON "team_info_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_info_requests_status_idx" ON "team_info_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_info_requests_created_by_idx" ON "team_info_requests" USING btree ("created_by");