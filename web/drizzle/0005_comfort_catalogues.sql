CREATE TABLE "comfort_catalogues" (
	"game_version" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"catalogue" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "structures_daily" ADD COLUMN "placed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "structures_daily" AS "daily" SET "placed" = "counted"."placed" FROM (SELECT ("at" AT TIME ZONE 'UTC')::date AS "date", "prefab", coalesce("player_id", 0) AS "builder_player_id", count(*)::int AS "placed" FROM "structure_events" WHERE "kind" = 'built' AND "creator_character_id" IS NOT NULL GROUP BY 1, 2, 3) AS "counted" WHERE "daily"."date" = "counted"."date" AND "daily"."prefab" = "counted"."prefab" AND "daily"."builder_player_id" = "counted"."builder_player_id";
