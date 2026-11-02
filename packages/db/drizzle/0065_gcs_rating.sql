CREATE TABLE "rating_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"formula_version" integer NOT NULL,
	"model" jsonb NOT NULL,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sample_maps" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD COLUMN "rating" real;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD COLUMN "rating_rounds" integer;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD COLUMN "rating_components" jsonb;--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD COLUMN "rating_model_id" integer;--> statement-breakpoint
CREATE INDEX "rating_models_is_active_idx" ON "rating_models" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "map_player_stats" ADD CONSTRAINT "map_player_stats_rating_model_id_rating_models_id_fk" FOREIGN KEY ("rating_model_id") REFERENCES "public"."rating_models"("id") ON DELETE set null ON UPDATE no action;