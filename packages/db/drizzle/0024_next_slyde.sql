CREATE TABLE "about_team_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" jsonb NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "about_team_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "about_team_member_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"category_id" bigint,
	"display_role" jsonb,
	"is_visible" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "about_team_member_settings" ADD CONSTRAINT "about_team_member_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "about_team_member_settings" ADD CONSTRAINT "about_team_member_settings_category_id_about_team_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."about_team_categories"("id") ON DELETE set null ON UPDATE no action;