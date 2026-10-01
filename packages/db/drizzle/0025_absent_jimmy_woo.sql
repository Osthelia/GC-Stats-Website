CREATE TABLE "oauth_access_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_hash" char(64) NOT NULL,
	"client_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_access_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_codes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code_hash" char(64) NOT NULL,
	"client_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_authorization_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" char(64),
	"is_confidential" boolean DEFAULT true NOT NULL,
	"redirect_uris" text[] DEFAULT '{}' NOT NULL,
	"allowed_scopes" text[] DEFAULT '{}' NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" bigint NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_consents_user_client_unique" UNIQUE("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_hash" char(64) NOT NULL,
	"client_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"rotated_to_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Not modeled with .references() in schema/oauth.ts (self-referential FK type cycle) — added by hand here, see DATABASES.MD §8.
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_rotated_to_id_oauth_refresh_tokens_id_fk" FOREIGN KEY ("rotated_to_id") REFERENCES "public"."oauth_refresh_tokens"("id") ON DELETE set null ON UPDATE no action;