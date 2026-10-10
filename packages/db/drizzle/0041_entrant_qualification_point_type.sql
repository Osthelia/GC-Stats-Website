ALTER TABLE "entrants" ADD COLUMN "qualification_source_point_type_id" bigint;--> statement-breakpoint
ALTER TABLE "entrants" ADD CONSTRAINT "entrants_qualification_source_point_type_id_point_types_id_fk" FOREIGN KEY ("qualification_source_point_type_id") REFERENCES "public"."point_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "entrants" SET "qualification_source_type" = NULL WHERE "qualification_source_type" = 'ranking';
