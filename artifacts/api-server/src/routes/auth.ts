import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq, lt, sql } from "drizzle-orm";
import { db, loginAttemptsTable, sessionsTable, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, GetCurrentUserResponse } from "@workspace/api-zod";
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  hashSessionToken,
  requireAuth,
  sessionCookieOptions,
} from "../lib/auth";
import { verifyPassword } from "../lib/password";

const router: IRouter = Router();
const SESSION_TOKEN_BYTES = 32;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function safeUser(user: {
  id: string;
  username: string;
  displayName: string;
  role: "event_planner" | "guest_list_checker";
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid username and password." });
    return;
  }

  const username = parsed.data.username.trim().toLowerCase();
  const attemptKey = createHash("sha256")
    .update(`${req.ip ?? req.socket.remoteAddress ?? "unknown"}:${username}`)
    .digest("hex");
  const now = Date.now();
  const windowStartedAt = new Date(now);
  const windowCutoff = new Date(now - LOGIN_WINDOW_MS);
  await db.delete(loginAttemptsTable).where(lt(loginAttemptsTable.windowStartedAt, windowCutoff));
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, windowStartedAt));
  const [attempt] = await db
    .insert(loginAttemptsTable)
    .values({ keyHash: attemptKey, attemptCount: 1, windowStartedAt })
    .onConflictDoUpdate({
      target: loginAttemptsTable.keyHash,
      set: {
        attemptCount: sql`CASE
          WHEN ${loginAttemptsTable.windowStartedAt} <= ${windowCutoff} THEN 1
          ELSE ${loginAttemptsTable.attemptCount} + 1
        END`,
        windowStartedAt: sql`CASE
          WHEN ${loginAttemptsTable.windowStartedAt} <= ${windowCutoff} THEN ${windowStartedAt}
          ELSE ${loginAttemptsTable.windowStartedAt}
        END`,
      },
    })
    .returning({ attemptCount: loginAttemptsTable.attemptCount });
  if (attempt.attemptCount > MAX_LOGIN_FAILURES) {
    res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const passwordValid = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !user.isActive || !passwordValid) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.keyHash, attemptKey));
  const sessionToken = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessionsTable).values({
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions());
  res.json(LoginResponse.parse({ user: safeUser(user) }));
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = res.locals.authUser;
  res.json(GetCurrentUserResponse.parse({ user }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && /^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).send();
});

export default router;
