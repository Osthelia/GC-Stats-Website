-- Hand-written (drizzle-kit generate needs an interactive TTY to resolve the
-- organization_access.role / organization_role_permissions.role column
-- changes, which isn't available here) — transforms the shape actually live
-- on Neon (0001_skinny_thunderbolt_ross: role as free text) into fully
-- customizable per-organization roles (organization_roles table, role_id
-- FKs). Safe against the current data: organization_access has exactly one
-- row (role='owner'), which naturally becomes role_id = NULL — the correct
-- immutable "owner" sentinel — the moment the column is added, no backfill
-- needed. organization_role_permissions has zero rows.
CREATE TABLE "organization_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" bigint NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "organization_roles_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "organization_roles" ADD CONSTRAINT "organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_access" ADD COLUMN "role_id" bigint;
--> statement-breakpoint
ALTER TABLE "organization_access" ADD CONSTRAINT "organization_access_role_id_organization_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."organization_roles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_access" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" DROP CONSTRAINT "organization_role_permissions_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" DROP CONSTRAINT "organization_role_permissions_unique";
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" ADD COLUMN "role_id" bigint NOT NULL;
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_role_id_organization_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."organization_roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" DROP COLUMN "organization_id";
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" DROP COLUMN "role";
--> statement-breakpoint
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_unique" UNIQUE("role_id","permission");
