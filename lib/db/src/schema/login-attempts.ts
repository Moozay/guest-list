import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const loginAttemptsTable = pgTable("login_attempts", {
  keyHash: text("key_hash").primaryKey(),
  attemptCount: integer("attempt_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("login_attempts_window_started_at_idx").on(table.windowStartedAt),
]);
