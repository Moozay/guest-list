import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  CreateUserResponse,
  ListUsersResponse,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { hashPassword } from "../lib/password";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.use("/users", requireAuth, requireRole("event_planner"));

router.get("/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(users));
});

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { fields: parsed.error.issues.map((issue) => issue.path.join(".")) },
      "Invalid staff account creation payload",
    );
    res.status(400).json({ error: "Check the account details and try again." });
    return;
  }

  const username = parsed.data.username.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        displayName,
        passwordHash,
        role: parsed.data.role,
        createdByUserId: res.locals.authUser.id,
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });
    res.status(201).json(CreateUserResponse.parse(user));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "That username is already in use." });
      return;
    }
    throw error;
  }
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Check the account update and try again." });
    return;
  }

  if (parsed.data.role === undefined && parsed.data.isActive === undefined && parsed.data.password === undefined) {
    res.status(400).json({ error: "Choose at least one account change." });
    return;
  }

  const currentUser = res.locals.authUser;
  if (
    params.data.id === currentUser.id
    && (parsed.data.isActive === false || parsed.data.role === "guest_list_checker")
  ) {
    res.status(400).json({ error: "You cannot deactivate or downgrade your own account." });
    return;
  }

  const passwordHash = parsed.data.password === undefined
    ? undefined
    : await hashPassword(parsed.data.password);
  const updateResult = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(72401931)`);
    const [target] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .limit(1)
      .for("update");
    if (!target) return { kind: "not-found" as const };

    const wouldDeactivatePlanner = target.role === "event_planner"
      && target.isActive
      && (parsed.data.isActive === false || parsed.data.role === "guest_list_checker");
    if (wouldDeactivatePlanner) {
      const [activePlanners] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(and(eq(usersTable.role, "event_planner"), eq(usersTable.isActive, true)));
      if (activePlanners.count <= 1) {
        return { kind: "last-active-planner" as const };
      }
    }

    const [user] = await tx
      .update(usersTable)
      .set({
        ...(parsed.data.role === undefined ? {} : { role: parsed.data.role }),
        ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
        ...(passwordHash === undefined ? {} : { passwordHash }),
      })
      .where(eq(usersTable.id, params.data.id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        displayName: usersTable.displayName,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    if (
      parsed.data.password !== undefined
      || parsed.data.isActive === false
      || parsed.data.role !== undefined
    ) {
      await tx.delete(sessionsTable).where(eq(sessionsTable.userId, params.data.id));
    }
    return { kind: "updated" as const, user };
  });

  if (updateResult.kind === "not-found") {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  if (updateResult.kind === "last-active-planner") {
    res.status(400).json({ error: "At least one active event planner account must remain." });
    return;
  }
  res.json(UpdateUserResponse.parse(updateResult.user));
});

export default router;
