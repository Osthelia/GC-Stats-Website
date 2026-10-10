ALTER TABLE "entrants" ADD COLUMN "qualification_source_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "qualification_source_type" text;--> statement-breakpoint
ALTER TABLE "entrants" ADD COLUMN "qualification_source_tournament_id" bigint;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_qualification_source_tournament_id_tournaments_id_fk" FOREIGN KEY ("qualification_source_tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;