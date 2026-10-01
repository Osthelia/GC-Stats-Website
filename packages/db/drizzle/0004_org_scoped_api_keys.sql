ALTER TABLE "api_key" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "organization_id" bigint;--> statement-breakpoint
-- Not representable in schema.ts (organizationId has no .references() there,
-- see the comment above the table) — same "circular import between auth.ts
-- and people.ts" reason as users.team_id, added raw here instead.
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_owner_check" CHECK (num_nonnulls("user_id", "organization_id") = 1);