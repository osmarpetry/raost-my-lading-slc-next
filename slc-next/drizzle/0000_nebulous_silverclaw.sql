CREATE TABLE "scan_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_type" text NOT NULL,
	"stage" text,
	"message" text NOT NULL,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submitted_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"root_url" text,
	"status" text NOT NULL,
	"current_step" text,
	"snapshot_hash" text,
	"quality_score" integer,
	"quality_band" text,
	"mobile_lighthouse_score" integer,
	"desktop_lighthouse_score" integer,
	"lighthouse_source" text NOT NULL,
	"lighthouse_reason" text,
	"openai_source" text NOT NULL,
	"openai_reason" text,
	"openai_model" text,
	"route_map_json" jsonb,
	"pages_json" jsonb,
	"external_links_json" jsonb,
	"lighthouse_mobile_json" jsonb,
	"lighthouse_desktop_json" jsonb,
	"site_understanding_json" jsonb,
	"final_payload_json" jsonb,
	"final_text" text,
	"preview_text" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_scan_id_scan_runs_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scan_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scan_events_scan_seq_idx" ON "scan_events" USING btree ("scan_id","seq");--> statement-breakpoint
CREATE INDEX "scan_runs_snapshot_hash_idx" ON "scan_runs" USING btree ("snapshot_hash");--> statement-breakpoint
CREATE INDEX "scan_runs_created_at_idx" ON "scan_runs" USING btree ("created_at");