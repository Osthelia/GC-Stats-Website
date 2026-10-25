ALTER TYPE "container_type" ADD VALUE IF NOT EXISTS 'set';--> statement-breakpoint
ALTER TABLE "stage_containers" ADD COLUMN "parent_id" bigint;--> statement-breakpoint
ALTER TABLE "stage_containers" ADD CONSTRAINT "stage_containers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stage_containers"("id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "stage_containers_parent_id_idx" ON "stage_containers" ("parent_id");
