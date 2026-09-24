ALTER TABLE "raids" ADD COLUMN "end_reason" text;--> statement-breakpoint
ALTER TABLE "raids" ADD COLUMN "restored" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "raids" ADD COLUMN "resume_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "raids" ADD COLUMN "active_s" double precision;--> statement-breakpoint
ALTER TABLE "server_runs" ADD COLUMN "last_heartbeat_received_at" timestamp with time zone;