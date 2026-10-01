CREATE TABLE "change_request_discord_notices" (
	"change_request_id" bigint PRIMARY KEY NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_request_discord_notices" ADD CONSTRAINT "change_request_discord_notices_change_request_id_change_requests_id_fk" FOREIGN KEY ("change_request_id") REFERENCES "public"."change_requests"("id") ON DELETE cascade ON UPDATE no action;