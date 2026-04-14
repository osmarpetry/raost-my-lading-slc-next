import { relations } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const scanRuns = pgTable(
  "scan_runs",
  {
    id: uuid("id").primaryKey(),
    submittedUrl: text("submitted_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    rootUrl: text("root_url"),
    status: text("status").notNull(),
    currentStep: text("current_step"),
    snapshotHash: text("snapshot_hash"),
    qualityScore: integer("quality_score"),
    qualityBand: text("quality_band"),
    mobileLighthouseScore: integer("mobile_lighthouse_score"),
    desktopLighthouseScore: integer("desktop_lighthouse_score"),
    lighthouseSource: text("lighthouse_source").notNull(),
    lighthouseReason: text("lighthouse_reason"),
    openaiSource: text("openai_source").notNull(),
    openaiReason: text("openai_reason"),
    openaiModel: text("openai_model"),
    routeMapJson: jsonb("route_map_json"),
    pagesJson: jsonb("pages_json"),
    externalLinksJson: jsonb("external_links_json"),
    lighthouseMobileJson: jsonb("lighthouse_mobile_json"),
    lighthouseDesktopJson: jsonb("lighthouse_desktop_json"),
    siteUnderstandingJson: jsonb("site_understanding_json"),
    finalPayloadJson: jsonb("final_payload_json"),
    finalText: text("final_text"),
    previewText: text("preview_text"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("scan_runs_snapshot_hash_idx").on(table.snapshotHash),
    index("scan_runs_created_at_idx").on(table.createdAt),
  ],
);

export const scanEvents = pgTable(
  "scan_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scanRuns.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(),
    stage: text("stage"),
    message: text("message").notNull(),
    payloadJson: jsonb("payload_json"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("scan_events_scan_seq_idx").on(table.scanId, table.seq)],
);

export const scanRunsRelations = relations(scanRuns, ({ many }) => ({
  events: many(scanEvents),
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  scan: one(scanRuns, {
    fields: [scanEvents.scanId],
    references: [scanRuns.id],
  }),
}));
