ALTER TABLE "organization_access" DROP CONSTRAINT "organization_access_role_id_organization_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_access" DROP COLUMN "role_id";