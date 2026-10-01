CREATE TABLE "organization_access" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" bigint NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "organization_access_user_org_unique" UNIQUE("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_role_permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" bigint NOT NULL,
	"role" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "organization_role_permissions_unique" UNIQUE("organization_id","role","permission")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_author" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_access" ADD CONSTRAINT "organization_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_access" ADD CONSTRAINT "organization_access_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_role_permissions" ADD CONSTRAINT "organization_role_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;