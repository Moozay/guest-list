import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import type { UserRole } from "@workspace/api-zod";

export const SESSION_COOKIE = "guest_session";
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_DURATION_MS,
  };
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const [session] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(
      eq(sessionsTable.tokenHash, hashSessionToken(token)),
      gt(sessionsTable.expiresAt, new Date()),
      eq(usersTable.isActive, true),
    ))
    .limit(1);

  if (!session) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  res.locals.authUser = session satisfies AuthenticatedUser;
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.authUser as AuthenticatedUser | undefined;
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "You do not have access to this resource." });
      return;
    }
    next();
  };
}
