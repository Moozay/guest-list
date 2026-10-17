import { and, eq, sql } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { hashPassword } from "./lib/password";

const username = process.env.EVENT_PLANNER_USERNAME?.trim().toLowerCase();
const password = process.env.EVENT_PLANNER_PASSWORD;
const displayName = (process.env.EVENT_PLANNER_DISPLAY_NAME ?? "Emmanuella").trim();

if (!username || !/^[a-z0-9._-]{3,64}$/.test(username)) {
  throw new Error("Set EVENT_PLANNER_USERNAME to a 3-64 character username.");
}
if (!password || password.length < 12 || password.length > 128) {
  throw new Error("Set EVENT_PLANNER_PASSWORD to a password between 12 and 128 characters.");
}
if (displayName.length < 2 || displayName.length > 120) {
  throw new Error("EVENT_PLANNER_DISPLAY_NAME must be between 2 and 120 characters.");
}

try {
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72401931)`);
    const [activePlanners] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(and(eq(usersTable.role, "event_planner"), eq(usersTable.isActive, true)));
    if (activePlanners.count > 0) {
      throw new Error("An active event planner already exists; use the staff account manager instead.");
    }

    const [user] = await tx
      .insert(usersTable)
      .values({
        username,
        displayName,
        passwordHash,
        role: "event_planner",
      })
      .onConflictDoNothing({ target: usersTable.username })
      .returning({ id: usersTable.id });

    if (!user) {
      throw new Error("That username already exists; no account was changed.");
    }
  });
  console.log(`Created the initial event planner account "${username}".`);
} finally {
  await pool.end();
}
