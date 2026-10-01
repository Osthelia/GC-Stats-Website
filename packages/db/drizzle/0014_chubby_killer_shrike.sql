CREATE TABLE "organization_member_role_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" bigint NOT NULL,
	"member_role" text NOT NULL,
	"permission_role_id" bigint,
	CONSTRAINT "organization_member_role_links_org_role_unique" UNIQUE("organization_id","member_role")
);
--> statement-breakpoint
ALTER TABLE "organization_member_role_links" ADD CONSTRAINT "organization_member_role_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_role_links" ADD CONSTRAINT "organization_member_role_links_permission_role_id_organization_roles_id_fk" FOREIGN KEY ("permission_role_id") REFERENCES "public"."organization_roles"("id") ON DELETE no action ON UPDATE no action;