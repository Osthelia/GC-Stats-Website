CREATE TABLE "organization_access_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"access_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	CONSTRAINT "organization_access_roles_unique" UNIQUE("access_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "organization_access" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill from the old single-role model (role_id IS NULL = owner sentinel,
-- otherwise exactly one role) before it's dropped in the next migration —
-- see organization_access/organization_access_roles' schema comments.
UPDATE "organization_access" SET "is_owner" = true WHERE "role_id" IS NULL;
--> statement-breakpoint
INSERT INTO "organization_access_roles" ("access_id", "role_id") SELECT "id", "role_id" FROM "organization_access" WHERE "role_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "organization_access_roles" ADD CONSTRAINT "organization_access_roles_access_id_organization_access_id_fk" FOREIGN KEY ("access_id") REFERENCES "public"."organization_access"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_access_roles" ADD CONSTRAINT "organization_access_roles_role_id_organization_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."organization_roles"("id") ON DELETE cascade ON UPDATE no action;
