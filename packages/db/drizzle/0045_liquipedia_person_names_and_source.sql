CREATE TABLE IF NOT EXISTS "liquipedia_person_names" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "liquipedia_person_names_person_id_unique" UNIQUE("person_id")
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "liquipedia_sourced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "liquipedia_sourced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "liquipedia_person_names" ADD CONSTRAINT "liquipedia_person_names_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "liquipedia_person_names_name_lower_unique" ON "liquipedia_person_names" USING btree (lower("name"));
