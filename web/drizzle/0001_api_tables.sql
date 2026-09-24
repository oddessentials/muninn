CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"file" text NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"ok" boolean NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "biome_visits" (
	"player_id" integer NOT NULL,
	"biome" text NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"first_day" integer NOT NULL,
	"last_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "biome_visits_player_id_biome_pk" PRIMARY KEY("player_id","biome")
);
--> statement-breakpoint
CREATE TABLE "boss_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"prefab" text,
	"name_key" text,
	"at" timestamp with time zone NOT NULL,
	"world_day" integer NOT NULL,
	"x" double precision,
	"z" double precision,
	"biome" text,
	"nearby_player_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participant_player_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summoner_player_id" integer,
	"first_time" boolean,
	"alert_message" text,
	"method" text
);
--> statement-breakpoint
CREATE TABLE "boss_kills" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"key" text NOT NULL,
	"killed_at" timestamp with time zone NOT NULL,
	"world_day" integer NOT NULL,
	"first_time" boolean NOT NULL,
	"sender_player_id" integer,
	"nearby_player_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participant_player_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prefab" text,
	"name_key" text
);
--> statement-breakpoint
CREATE TABLE "boss_prefabs" (
	"prefab" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_key" text
);
--> statement-breakpoint
CREATE TABLE "boss_state" (
	"key" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"engaged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"character_id" bigint NOT NULL,
	"name" text NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"world_day" integer NOT NULL,
	"kind" text NOT NULL,
	"player_id" integer,
	"text" text,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"biome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creature_deaths" (
	"date" date NOT NULL,
	"creature" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "creature_deaths_date_creature_pk" PRIMARY KEY("date","creature")
);
--> statement-breakpoint
CREATE TABLE "deaths" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"player_id" integer NOT NULL,
	"character_id" bigint,
	"died_at" timestamp with time zone NOT NULL,
	"world_day" integer NOT NULL,
	"biome" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"hit_type" text,
	"attacker_prefab" text,
	"attacker_player_id" integer
);
--> statement-breakpoint
CREATE TABLE "event_players" (
	"event_id" uuid NOT NULL,
	"player_id" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	CONSTRAINT "event_players_event_id_player_id_pk" PRIMARY KEY("event_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_day" integer NOT NULL,
	"data" jsonb NOT NULL,
	"player_id" integer
);
--> statement-breakpoint
CREATE TABLE "global_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"first_set_at" timestamp with time zone NOT NULL,
	"world_day" integer NOT NULL,
	"event_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"world_day" integer NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" integer NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"events" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"progress" double precision,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "kills" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"player_id" integer NOT NULL,
	"creature" text NOT NULL,
	"level" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"basis" text NOT NULL,
	"boss" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_images" (
	"world_uid" bigint PRIMARY KEY NOT NULL,
	"png" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"radius" double precision NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_aliases" (
	"platform_user_id" text PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"display_id" text NOT NULL,
	"platform" text NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_user_id" text NOT NULL,
	"display_id" text NOT NULL,
	"platform" text NOT NULL,
	"display_name" text NOT NULL,
	"display_name_override" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"playtime_s" double precision DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"kills_credited" integer DEFAULT 0 NOT NULL,
	"kills_nearby" integer DEFAULT 0 NOT NULL,
	"boss_kills" integer DEFAULT 0 NOT NULL,
	"raids" integer DEFAULT 0 NOT NULL,
	"structures_built" integer DEFAULT 0 NOT NULL,
	"structures_destroyed" integer DEFAULT 0 NOT NULL,
	"shouts" integer DEFAULT 0 NOT NULL,
	"distance_m" double precision DEFAULT 0 NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"current_session_id" integer,
	"last_biome" text,
	"last_x" double precision,
	"last_z" double precision,
	"last_position_at" timestamp with time zone,
	"last_character_name" text
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"player_id" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"biome" text NOT NULL,
	CONSTRAINT "positions_player_id_ts_pk" PRIMARY KEY("player_id","ts")
);
--> statement-breakpoint
CREATE TABLE "raids" (
	"id" serial PRIMARY KEY NOT NULL,
	"start_event_id" uuid NOT NULL,
	"end_event_id" uuid,
	"run_id" uuid NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"world_day" integer NOT NULL,
	"biome" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"planned_duration_s" double precision NOT NULL,
	"participant_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saves" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_runs" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"stopped_at" timestamp with time zone,
	"stop_reason" text,
	"game_version" text,
	"network_version" integer,
	"plugin_version" text,
	"bepinex_version" text,
	"unity_version" text,
	"world_name" text,
	"world_uid" bigint,
	"last_heartbeat_at" timestamp with time zone,
	"last_net_time" double precision,
	"last_world_day" integer,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"peak_players" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"missing_hooks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"queue_depth" integer,
	"dropped_events" integer,
	"uptime_s" double precision,
	"last_save_age_s" double precision
);
--> statement-breakpoint
CREATE TABLE "server_status" (
	"id" integer PRIMARY KEY NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"player_count" integer DEFAULT 0 NOT NULL,
	"max_players" integer DEFAULT 10 NOT NULL,
	"source" text DEFAULT 'none' NOT NULL,
	"game_version" text,
	"network_version" integer,
	"server_name" text,
	"world_name" text,
	"world_uid" bigint,
	"world_day" integer,
	"net_time" double precision,
	"net_time_at" timestamp with time zone,
	"last_save_at" timestamp with time zone,
	"last_save_duration_ms" integer,
	"last_plugin_at" timestamp with time zone,
	"telemetry_delayed_since" timestamp with time zone,
	"a2s_online" boolean,
	"a2s_player_count" integer,
	"a2s_max_players" integer,
	"a2s_game_version" text,
	"a2s_network_version" integer,
	"a2s_server_name" text,
	"a2s_last_ok_at" timestamp with time zone,
	"a2s_last_error" text,
	"a2s_checked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"character_id" bigint,
	"character_name" text NOT NULL,
	"run_id" uuid NOT NULL,
	"peer_uid" bigint NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"duration_s" double precision,
	"left_reason" text,
	"join_event_id" uuid,
	"left_event_id" uuid
);
--> statement-breakpoint
CREATE TABLE "status_samples" (
	"ts" timestamp with time zone PRIMARY KEY NOT NULL,
	"online" boolean NOT NULL,
	"player_count" integer NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structure_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"prefab" text NOT NULL,
	"x" double precision NOT NULL,
	"z" double precision NOT NULL,
	"biome" text NOT NULL,
	"player_id" integer,
	"creator_character_id" bigint
);
--> statement-breakpoint
CREATE TABLE "structures_daily" (
	"date" date NOT NULL,
	"prefab" text NOT NULL,
	"builder_player_id" integer DEFAULT 0 NOT NULL,
	"built" integer DEFAULT 0 NOT NULL,
	"destroyed" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "structures_daily_date_prefab_builder_player_id_pk" PRIMARY KEY("date","prefab","builder_player_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "boss_events_event_idx" ON "boss_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "boss_events_key_at_idx" ON "boss_events" USING btree ("key","at");--> statement-breakpoint
CREATE UNIQUE INDEX "boss_kills_event_idx" ON "boss_kills" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "boss_kills_key_at_idx" ON "boss_kills" USING btree ("key","killed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_player_character_idx" ON "characters" USING btree ("player_id","character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_event_idx" ON "chat_messages" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "chat_messages_at_idx" ON "chat_messages" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "deaths_event_idx" ON "deaths" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "deaths_player_at_idx" ON "deaths" USING btree ("player_id","died_at");--> statement-breakpoint
CREATE INDEX "deaths_at_idx" ON "deaths" USING btree ("died_at");--> statement-breakpoint
CREATE INDEX "event_players_player_ts_idx" ON "event_players" USING btree ("player_id","ts");--> statement-breakpoint
CREATE INDEX "events_ts_seq_idx" ON "events" USING btree ("ts","seq");--> statement-breakpoint
CREATE INDEX "events_type_ts_idx" ON "events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX "events_run_seq_idx" ON "events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "events_player_ts_idx" ON "events" USING btree ("player_id","ts");--> statement-breakpoint
CREATE INDEX "heartbeats_ts_idx" ON "heartbeats" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "ingest_batches_received_idx" ON "ingest_batches" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kills_event_player_idx" ON "kills" USING btree ("event_id","player_id");--> statement-breakpoint
CREATE INDEX "kills_player_at_idx" ON "kills" USING btree ("player_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "players_platform_user_id_idx" ON "players" USING btree ("platform_user_id");--> statement-breakpoint
CREATE INDEX "players_last_seen_idx" ON "players" USING btree ("last_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "raids_start_event_idx" ON "raids" USING btree ("start_event_id");--> statement-breakpoint
CREATE INDEX "raids_started_idx" ON "raids" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saves_event_idx" ON "saves" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "saves_at_idx" ON "saves" USING btree ("at");--> statement-breakpoint
CREATE INDEX "server_runs_started_idx" ON "server_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_run_peer_joined_idx" ON "sessions" USING btree ("run_id","peer_uid","joined_at");--> statement-breakpoint
CREATE INDEX "sessions_player_joined_idx" ON "sessions" USING btree ("player_id","joined_at");--> statement-breakpoint
CREATE INDEX "sessions_open_idx" ON "sessions" USING btree ("run_id","left_at");--> statement-breakpoint
CREATE UNIQUE INDEX "structure_events_event_idx" ON "structure_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "structure_events_at_idx" ON "structure_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "structure_events_player_at_idx" ON "structure_events" USING btree ("player_id","at");