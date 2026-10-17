import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, invitesTable, usersTable } from "@workspace/db";
import {
  CheckInInviteParams,
  CheckInInviteResponse,
  CreateInviteBody,
  CreateInviteResponse,
  DeleteInviteParams,
  GetInviteParams,
  GetInviteResponse,
  GetInviteSummaryResponse,
  ListInvitesResponse,
  ResolveInviteBody,
  ResolveInviteResponse,
  UpdateInviteBody,
  UpdateInviteResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();
const qrMarker = "GUEST_INVITE_V1:";
const inviteCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createInviteCode(): string {
  return Array.from(randomBytes(8), (byte) => inviteCodeAlphabet.charAt(byte & 31)).join("");
}

router.get("/invites", requireAuth, requireRole("event_planner"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({ invite: invitesTable, createdByName: usersTable.displayName })
    .from(invitesTable)
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .orderBy(desc(invitesTable.createdAt));
  const invites = rows.map(({ invite, createdByName }) => ({ ...invite, createdByName }));
  res.json(ListInvitesResponse.parse(invites));
});

router.get("/invites/summary", requireAuth, requireRole("event_planner"), async (_req, res): Promise<void> => {
  const [summary] = await db
    .select({
      totalInvites: sql<number>`count(*)::int`,
      totalGuests: sql<number>`coalesce(sum(${invitesTable.numberOfGuests}), 0)::int`,
      arrivedInvites: sql<number>`count(*) filter (where ${invitesTable.arrivedAt} is not null)::int`,
      arrivedGuests: sql<number>`coalesce(sum(case when ${invitesTable.arrivedAt} is not null then ${invitesTable.numberOfGuests} else 0 end), 0)::int`,
    })
    .from(invitesTable);
  res.json(
    GetInviteSummaryResponse.parse(
      summary ?? {
        totalInvites: 0,
        totalGuests: 0,
        arrivedInvites: 0,
        arrivedGuests: 0,
      },
    ),
  );
});

router.post("/invites", requireAuth, requireRole("event_planner"), async (req, res): Promise<void> => {
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { fields: parsed.error.issues.map((issue) => issue.path.join(".")) },
      "Invalid invite form data",
    );
    res.status(400).json({ error: "Check the invite details and try again." });
    return;
  }

  const input = {
    ...parsed.data,
    fullName: parsed.data.fullName.trim(),
    phoneNumber: parsed.data.phoneNumber.trim(),
    email: parsed.data.email?.trim() ?? "",
  };
  const normalized = CreateInviteBody.safeParse(input);
  const phoneDigits = input.phoneNumber.replace(/\D/g, "").length;
  const emailIsInvalid = input.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email);
  if (
    !normalized.success
    || !/^[+()\d\s.-]+$/.test(input.phoneNumber)
    || phoneDigits < 5
    || emailIsInvalid
  ) {
    res.status(400).json({ error: "Check the invite details and try again." });
    return;
  }

  const [invite] = await db
    .insert(invitesTable)
    .values({
      ...normalized.data,
      email: input.email || null,
      inviteCode: createInviteCode(),
      createdByUserId: res.locals.authUser.id,
    })
    .returning();
  res.status(201).json(CreateInviteResponse.parse({
    ...invite,
    createdByName: res.locals.authUser.displayName,
  }));
});

router.post("/invites/resolve", requireAuth, requireRole("event_planner", "guest_list_checker"), async (req, res): Promise<void> => {
  const parsed = ResolveInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.json(ResolveInviteResponse.parse({ status: "not_valid", invite: null }));
    return;
  }

  const match = new RegExp(`^${qrMarker}([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$`, "i")
    .exec(parsed.data.qrPayload);
  if (!match) {
    res.json(ResolveInviteResponse.parse({ status: "not_valid", invite: null }));
    return;
  }

  const [row] = await db
    .select({ invite: invitesTable, createdByName: usersTable.displayName })
    .from(invitesTable)
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .where(eq(invitesTable.id, match[1]))
    .limit(1);
  if (!row) {
    res.json(ResolveInviteResponse.parse({ status: "not_valid", invite: null }));
    return;
  }
  const invite = { ...row.invite, createdByName: row.createdByName };

  res.json(
    ResolveInviteResponse.parse({
      status: invite.arrivedAt ? "already_checked_in" : "valid",
      invite,
    }),
  );
});

router.get("/invites/:id", requireAuth, requireRole("event_planner", "guest_list_checker"), async (req, res): Promise<void> => {
  const params = GetInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invite ID." });
    return;
  }

  const [row] = await db
    .select({ invite: invitesTable, createdByName: usersTable.displayName })
    .from(invitesTable)
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .where(eq(invitesTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  res.json(GetInviteResponse.parse({ ...row.invite, createdByName: row.createdByName }));
});

router.patch("/invites/:id", requireAuth, requireRole("event_planner"), async (req, res): Promise<void> => {
  const params = GetInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invite ID." });
    return;
  }

  const parsed = UpdateInviteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { fields: parsed.error.issues.map((issue) => issue.path.join(".")) },
      "Invalid invite update payload",
    );
    res.status(400).json({ error: "Check the invite details and try again." });
    return;
  }

  const input = {
    ...parsed.data,
    fullName: parsed.data.fullName.trim(),
    phoneNumber: parsed.data.phoneNumber.trim(),
    email: parsed.data.email?.trim(),
  };
  const normalized = UpdateInviteBody.safeParse(input);
  const phoneDigits = input.phoneNumber.replace(/\D/g, "").length;
  const emailIsInvalid = Boolean(
    input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email),
  );
  if (
    !normalized.success
    || !/^[+()\d\s.-]+$/.test(input.phoneNumber)
    || phoneDigits < 5
    || emailIsInvalid
  ) {
    res.status(400).json({ error: "Check the invite details and try again." });
    return;
  }

  const [updatedInvite] = await db
    .update(invitesTable)
    .set({
      ...normalized.data,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      email: input.email === undefined ? undefined : input.email || null,
    })
    .where(eq(invitesTable.id, params.data.id))
    .returning();

  if (!updatedInvite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  const [creator] = updatedInvite.createdByUserId
    ? await db.select({ displayName: usersTable.displayName }).from(usersTable)
      .where(eq(usersTable.id, updatedInvite.createdByUserId)).limit(1)
    : [];
  res.json(UpdateInviteResponse.parse({
    ...updatedInvite,
    createdByName: creator?.displayName ?? null,
  }));
});

router.delete("/invites/:id", requireAuth, requireRole("event_planner"), async (req, res): Promise<void> => {
  const params = DeleteInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invite ID." });
    return;
  }

  const [deletedInvite] = await db
    .delete(invitesTable)
    .where(eq(invitesTable.id, params.data.id))
    .returning({ id: invitesTable.id });

  if (!deletedInvite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  res.status(204).send();
});

router.post("/invites/:id/check-in", requireAuth, requireRole("event_planner", "guest_list_checker"), async (req, res): Promise<void> => {
  const params = CheckInInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invite ID." });
    return;
  }

  const [updatedInvite] = await db
    .update(invitesTable)
    .set({ arrivedAt: new Date() })
    .where(and(eq(invitesTable.id, params.data.id), isNull(invitesTable.arrivedAt)))
    .returning();

  const [row] = await db
    .select({ invite: invitesTable, createdByName: usersTable.displayName })
    .from(invitesTable)
    .leftJoin(usersTable, eq(invitesTable.createdByUserId, usersTable.id))
    .where(eq(invitesTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }
  const invite = { ...row.invite, createdByName: row.createdByName };

  res.json(
    CheckInInviteResponse.parse({
      invite,
      alreadyCheckedIn: !updatedInvite,
    }),
  );
});

export default router;
