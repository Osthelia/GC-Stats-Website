-- Hand-written (not drizzle-kit generate output): renaming a table/columns
-- while preserving real data needs data-safe statements (RENAME COLUMN,
-- TRIM before retype, etc.) that drizzle-kit's naive add+drop diff can't
-- express — same reasoning as 0001_constraints.sql inside
-- 0000_squashed_baseline.sql. drizzle-kit generate also can't run here at
-- all (its rename-detection prompts require an interactive TTY); this file
-- was written to match the schema.ts diff exactly and the accompanying
-- meta/0003_snapshot.json was hand-derived from meta/0002_snapshot.json to
-- keep future `generate` diffs clean.
--
-- Organizations replace news_publishers (SUIVI.MD decision) — verified
-- against Neon before writing this: news_publishers/organizations already
-- share the same 3 ids/names, and stream_channels/vods publisher_id values
-- in prod are only NULL or 2, so a straight rename is safe, no backfill
-- mapping needed.
--
-- news_messages + news.submitted_by/submitted_at/reviewed_by/reviewed_at
-- (private conversation + PR-style review workflow, added later the same
-- day) were generated normally by drizzle-kit (pure additions, no rename
-- ambiguity) as 0004_news_review_workflow.sql, then folded in here and
-- deleted — still nothing applied to Neon at that point, same rationale as
-- the 0001/0002 in-place regenerations documented in SUIVI.MD.

CREATE TABLE "news_languages" (
	"code" varchar(10) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO "news_languages" ("code", "name", "sort_order", "is_active") VALUES
	('en', 'English', 0, true),
	('fr', 'Français', 1, true),
	('de', 'Deutsch', 2, true),
	('es', 'Español', 3, true),
	('it', 'Italiano', 4, true),
	('pt', 'Português', 5, true),
	('ja', '日本語', 6, true),
	('zh_Hans', '简体中文', 7, true),
	('ar', 'العربية', 8, true);
--> statement-breakpoint
UPDATE "news" SET "lang" = TRIM("lang");
--> statement-breakpoint
ALTER TABLE "news" DROP CONSTRAINT "news_publisher_id_news_publishers_id_fk";
--> statement-breakpoint
ALTER TABLE "stream_channels" DROP CONSTRAINT "stream_channels_publisher_id_news_publishers_id_fk";
--> statement-breakpoint
ALTER TABLE "vods" DROP CONSTRAINT "vods_publisher_id_news_publishers_id_fk";
--> statement-breakpoint
ALTER TABLE "news" RENAME COLUMN "publisher_id" TO "organization_id";
--> statement-breakpoint
ALTER TABLE "stream_channels" RENAME COLUMN "publisher_id" TO "organization_id";
--> statement-breakpoint
ALTER TABLE "vods" RENAME COLUMN "publisher_id" TO "organization_id";
--> statement-breakpoint
ALTER TABLE "news" ALTER COLUMN "lang" TYPE varchar(10);
--> statement-breakpoint
ALTER TABLE "news" ALTER COLUMN "lang" SET DEFAULT 'en';
--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_lang_news_languages_code_fk" FOREIGN KEY ("lang") REFERENCES "public"."news_languages"("code") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stream_channels" ADD CONSTRAINT "stream_channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "vods" ADD CONSTRAINT "vods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
DROP TABLE "news_publishers";
--> statement-breakpoint
CREATE TABLE "news_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"news_id" bigint NOT NULL,
	"user_id" text,
	"type" text DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "submitted_by" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "news" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_messages" ADD CONSTRAINT "news_messages_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_messages" ADD CONSTRAINT "news_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
