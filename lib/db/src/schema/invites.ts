import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitesTable = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: text("full_name").notNull(),
  numberOfGuests: integer("number_of_guests").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
});

export const insertInviteSchema = createInsertSchema(invitesTable).omit({
  id: true,
  createdAt: true,
  arrivedAt: true,
});

export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type InviteRecord = typeof invitesTable.$inferSelect;
