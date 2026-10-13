import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, invitesTable } from "@workspace/db";
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

const router: IRouter = Router();
const qrMarker = "GUEST_INVITE_V1:";
const inviteCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createInviteCode(): string {
  return Array.from(randomBytes(8), (byte) => inviteCodeAlphabet.charAt(byte & 31)).join("");
}

router.get("/invites", async (_req, res): Promise<void> => {
  const invites = await db
    .select()
    .from(invitesTable)
    .orderBy(desc(invitesTable.createdAt));
  res.json(ListInvitesResponse.parse(invites));
});

router.get("/invites/summary", async (_req, res): Promise<void> => {
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

router.post("/invites", async (req, res): Promise<void> => {
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
    email: parsed.data.email.trim(),
  };
  const normalized = CreateInviteBody.safeParse(input);
  const phoneDigits = input.phoneNumber.replace(/\D/g, "").length;
  if (
    !normalized.success
    || !/^[+()\d\s.-]+$/.test(input.phoneNumber)
    || phoneDigits < 5
  ) {
    res.status(400).json({ error: "Check the invite details and try again." });
    return;
  }

  const [invite] = await db
    .insert(invitesTable)
    .values({
      ...normalized.data,
      inviteCode: createInviteCode(),
    })
    .returning();
  res.status(201).json(CreateInviteResponse.parse(invite));
});

router.post("/invites/resolve", async (req, res): Promise<void> => {
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

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.id, match[1]))
    .limit(1);
  if (!invite) {
    res.json(ResolveInviteResponse.parse({ status: "not_valid", invite: null }));
    return;
  }

  res.json(
    ResolveInviteResponse.parse({
      status: invite.arrivedAt ? "already_checked_in" : "valid",
      invite,
    }),
  );
});

router.get("/invites/:id", async (req, res): Promise<void> => {
  const params = GetInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invite ID." });
    return;
  }

  const [invite] = await db
    .select()
    .from(invitesTable)
    .where(eq(invitesTable.id, params.data.id))
    .limit(1);
  if (!invite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  res.json(GetInviteResponse.parse(invite));
});

router.patch("/invites/:id", async (req, res): Promise<void> => {
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
    email: parsed.data.email.trim(),
  };
  const normalized = UpdateInviteBody.safeParse(input);
  const phoneDigits = input.phoneNumber.replace(/\D/g, "").length;
  if (
    !normalized.success
    || !/^[+()\d\s.-]+$/.test(input.phoneNumber)
    || phoneDigits < 5
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
      email: input.email,
    })
    .where(eq(invitesTable.id, params.data.id))
    .returning();

  if (!updatedInvite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  res.json(UpdateInviteResponse.parse(updatedInvite));
});

router.delete("/invites/:id", async (req, res): Promise<void> => {
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

router.post("/invites/:id/check-in", async (req, res): Promise<void> => {
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

  const invite = updatedInvite ?? (
    await db
      .select()
      .from(invitesTable)
      .where(eq(invitesTable.id, params.data.id))
      .limit(1)
  )[0];
  if (!invite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  res.json(
    CheckInInviteResponse.parse({
      invite,
      alreadyCheckedIn: !updatedInvite,
    }),
  );
});

export default router;
