CREATE TABLE "zone_results" (
	"name" text PRIMARY KEY NOT NULL,
	"tested_at" timestamp with time zone NOT NULL,
	"overall" integer NOT NULL,
	"rating" text NOT NULL,
	"result" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
