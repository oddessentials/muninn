CREATE TABLE "creator_accounts" (
	"creator_id" bigint PRIMARY KEY NOT NULL,
	"platform_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
