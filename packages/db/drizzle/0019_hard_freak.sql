CREATE TABLE "rate_limit_counters" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
