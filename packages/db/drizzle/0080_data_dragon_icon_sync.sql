CREATE TABLE "lol_data_dragon_icons" (
	"kind" text NOT NULL,
	"icon_id" text NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lol_data_dragon_icons_kind_icon_id_pk" PRIMARY KEY("kind","icon_id")
);
--> statement-breakpoint
ALTER TABLE "lol_data_dragon_catalogs" ADD COLUMN "runes" jsonb;--> statement-breakpoint
ALTER TABLE "lol_data_dragon_catalogs" ADD COLUMN "icons_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lol_data_dragon_catalogs" ADD COLUMN "icons_sync_started_at" timestamp with time zone;