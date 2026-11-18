import { createHash, randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import {
  and,
  db,
  eq,
  inArray,
  isNull,
  sql,
  withAuthorizedWorkspace,
  type TenantDatabase,
} from "@repo/database";
import { getTenantDatabase } from "@repo/database/runtime";
import { withInvitationLookup } from "@repo/database/invitation-lookup";
import {
  usersTable,
  workspaceInvitationsTable,
  workspaceMembershipsTable,
  workspacesTable,
  workspaceAuditEventsTable,
} from "@repo/database/schema";
import { withWorkspaceAccess } from "../workspaces/access";
import { FormError } from "../forms/errors";
import {
  invitationAcceptSchema,
  invitationCreateSchema,
  invitationRevokeSchema,
  memberRemoveSchema,
  memberScopeSchema,
  memberUpdateSchema,
  type Team,
} from "./model";

async function currentVerifiedEmail(actorUserId: string): Promise<string | null> {
  const [local] = await db
    .select({ clerkUserId: usersTable.clerkUserId })
    .from(usersTable)
    .where(and(eq(usersTable.id, actorUserId), isNull(usersTable.deletedAt)))
    .limit(1);
  if (!local?.clerkUserId) return null;
  const profile = await createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  }).users.getUser(local.clerkUserId);
  if (profile.id !== local.clerkUserId || profile.banned || profile.locked) return null;
  const primary = profile.emailAddresses.find(
    (email) => email.id === profile.primaryEmailAddressId,
  );
  return primary?.verification?.status === "verified"
    ? primary.emailAddress.trim().toLowerCase()
    : null;
}
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export class MemberService {
  constructor(
    private readonly database: () => TenantDatabase = getTenantDatabase,
    private readonly verifiedEmail: (
      userId: string,
    ) => Promise<string | null> = currentVerifiedEmail,
  ) {}
  async list(actorUserId: string, request: { workspaceId: string }): Promise<Team> {
    const input = memberScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "workspace:read",
      async (transaction, role) => {
        const [workspace] = await transaction
          .select({ owner: workspacesTable.ownerUserId })
          .from(workspacesTable)
          .where(eq(workspacesTable.id, input.workspaceId));
        const memberships = await transaction
          .select({
            userId: workspaceMembershipsTable.userId,
            role: workspaceMembershipsTable.role,
          })
          .from(workspaceMembershipsTable)
          .where(eq(workspaceMembershipsTable.workspaceId, input.workspaceId))
          .limit(501);
        if (memberships.length > 500)
          throw new FormError(
            "INVALID",
            "This workspace has too many members to display. Contact the workspace owner.",
          );
        const members = [
          { userId: workspace!.owner, role: "OWNER" as const },
          ...memberships.filter((member) => member.userId !== workspace!.owner),
        ];
        const profiles = await db
          .select({ id: usersTable.id, name: usersTable.fullName, email: usersTable.email })
          .from(usersTable)
          .where(
            and(
              inArray(
                usersTable.id,
                members.map((member) => member.userId),
              ),
              isNull(usersTable.deletedAt),
            ),
          );
        const canManage = role === "OWNER" || role === "ADMIN";
        const invitations = canManage
          ? await transaction
              .select({
                id: workspaceInvitationsTable.id,
                email: workspaceInvitationsTable.email,
                role: workspaceInvitationsTable.role,
                expiresAt: workspaceInvitationsTable.expiresAt,
              })
              .from(workspaceInvitationsTable)
              .where(
                and(
                  eq(workspaceInvitationsTable.workspaceId, input.workspaceId),
                  isNull(workspaceInvitationsTable.revokedAt),
                  isNull(workspaceInvitationsTable.acceptedAt),
                  sql`${workspaceInvitationsTable.expiresAt}>clock_timestamp()`,
                ),
              )
              .orderBy(workspaceInvitationsTable.createdAt)
              .limit(100)
          : [];
        return {
          canManage,
          members: members.map((member) => {
            const profile = profiles.find((profile) => profile.id === member.userId);
            return {
              ...member,
              name: profile?.name ?? "Unavailable account",
              email: canManage ? (profile?.email ?? "") : "",
            };
          }),
          invitations: invitations.map((invite) => ({
            ...invite,
            expiresAt: invite.expiresAt.toISOString(),
          })),
        };
      },
    );
  }
  async invite(actorUserId: string, request: ReturnType<typeof invitationCreateSchema.parse>) {
    const input = invitationCreateSchema.parse(request),
      token = randomBytes(32).toString("hex");
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "members:manage",
      async (transaction) => {
        const [totals] = await transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(workspaceInvitationsTable)
          .where(
            and(
              eq(workspaceInvitationsTable.workspaceId, input.workspaceId),
              isNull(workspaceInvitationsTable.acceptedAt),
              isNull(workspaceInvitationsTable.revokedAt),
              sql`${workspaceInvitationsTable.expiresAt}>clock_timestamp()`,
            ),
          );
        if (totals!.count >= 100)
          throw new FormError("INVALID", "Revoke an existing invitation before creating another.");
        await transaction
          .update(workspaceInvitationsTable)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(workspaceInvitationsTable.workspaceId, input.workspaceId),
              eq(workspaceInvitationsTable.email, input.email),
              isNull(workspaceInvitationsTable.acceptedAt),
              isNull(workspaceInvitationsTable.revokedAt),
            ),
          );
        const [invitation] = await transaction
          .insert(workspaceInvitationsTable)
          .values({
            workspaceId: input.workspaceId,
            createdBy: actorUserId,
            email: input.email,
            role: input.role,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 7 * 86400000),
          })
          .returning({ id: workspaceInvitationsTable.id });
        await transaction.insert(workspaceAuditEventsTable).values({
          workspaceId: input.workspaceId,
          actorUserId,
          action: "member.invited",
          entityType: "invitation",
          entityId: invitation!.id,
        });
        return { token };
      },
      "update",
    );
  }
  async update(actorUserId: string, request: ReturnType<typeof memberUpdateSchema.parse>) {
    const input = memberUpdateSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "members:manage",
      async (transaction) => {
        const [workspace] = await transaction
          .select({ owner: workspacesTable.ownerUserId })
          .from(workspacesTable)
          .where(eq(workspacesTable.id, input.workspaceId));
        if (workspace!.owner === input.userId)
          throw new FormError("FORBIDDEN", "The workspace owner’s role cannot be changed.");
        const changed = await transaction
          .update(workspaceMembershipsTable)
          .set({ role: input.role })
          .where(
            and(
              eq(workspaceMembershipsTable.workspaceId, input.workspaceId),
              eq(workspaceMembershipsTable.userId, input.userId),
            ),
          )
          .returning({ id: workspaceMembershipsTable.id });
        if (!changed.length) throw new FormError("NOT_FOUND", "This member is unavailable.");
        await transaction.insert(workspaceAuditEventsTable).values({
          workspaceId: input.workspaceId,
          actorUserId,
          action: "member.role_changed",
          entityType: "user",
          entityId: input.userId,
          metadata: { role: input.role },
        });
        return { success: true as const };
      },
      "update",
    );
  }
  async remove(actorUserId: string, request: ReturnType<typeof memberRemoveSchema.parse>) {
    const input = memberRemoveSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "members:manage",
      async (transaction) => {
        const [workspace] = await transaction
          .select({ owner: workspacesTable.ownerUserId })
          .from(workspacesTable)
          .where(eq(workspacesTable.id, input.workspaceId));
        if (workspace!.owner === input.userId)
          throw new FormError("FORBIDDEN", "The workspace owner cannot be removed.");
        await transaction
          .delete(workspaceMembershipsTable)
          .where(
            and(
              eq(workspaceMembershipsTable.workspaceId, input.workspaceId),
              eq(workspaceMembershipsTable.userId, input.userId),
            ),
          );
        await transaction.insert(workspaceAuditEventsTable).values({
          workspaceId: input.workspaceId,
          actorUserId,
          action: "member.removed",
          entityType: "user",
          entityId: input.userId,
        });
        return { success: true as const };
      },
      "update",
    );
  }
  async revoke(actorUserId: string, request: ReturnType<typeof invitationRevokeSchema.parse>) {
    const input = invitationRevokeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "members:manage",
      async (transaction) => {
        await transaction
          .update(workspaceInvitationsTable)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(workspaceInvitationsTable.workspaceId, input.workspaceId),
              eq(workspaceInvitationsTable.id, input.invitationId),
              isNull(workspaceInvitationsTable.acceptedAt),
            ),
          );
        return { success: true as const };
      },
      "update",
    );
  }
  async accept(actorUserId: string, request: { token: string }) {
    const { token } = invitationAcceptSchema.parse(request),
      hash = hashToken(token),
      email = await this.verifiedEmail(actorUserId);
    if (!email)
      throw new FormError(
        "FORBIDDEN",
        "Verify your primary account email before accepting an invitation.",
      );
    const reference = await withInvitationLookup(this.database(), hash, async (transaction) => {
      const [invite] = await transaction
        .select({
          workspaceId: workspaceInvitationsTable.workspaceId,
          id: workspaceInvitationsTable.id,
        })
        .from(workspaceInvitationsTable)
        .where(eq(workspaceInvitationsTable.tokenHash, hash))
        .limit(1);
      if (!invite) throw new FormError("NOT_FOUND", "This invitation is unavailable.");
      return invite;
    });
    return withAuthorizedWorkspace(
      this.database(),
      reference.workspaceId,
      async (transaction) => {
        const [workspace] = await transaction
          .select({ owner: workspacesTable.ownerUserId })
          .from(workspacesTable)
          .where(
            and(eq(workspacesTable.id, reference.workspaceId), isNull(workspacesTable.deletedAt)),
          )
          .for("update");
        const [invitation] = await transaction
          .select()
          .from(workspaceInvitationsTable)
          .where(
            and(
              eq(workspaceInvitationsTable.workspaceId, reference.workspaceId),
              eq(workspaceInvitationsTable.id, reference.id),
            ),
          )
          .for("update");
        if (
          !workspace ||
          !invitation ||
          invitation.revokedAt ||
          invitation.expiresAt.getTime() <= Date.now()
        )
          throw new FormError("NOT_FOUND", "This invitation has expired or was revoked.");
        if (invitation.email !== email.toLowerCase())
          throw new FormError(
            "FORBIDDEN",
            "Sign in with the verified email address this invitation was sent to.",
          );
        if (invitation.acceptedAt) {
          if (invitation.acceptedBy !== actorUserId)
            throw new FormError("CONFLICT", "This invitation has already been used.");
          const [membership] = await transaction
            .select({ id: workspaceMembershipsTable.id })
            .from(workspaceMembershipsTable)
            .where(
              and(
                eq(workspaceMembershipsTable.workspaceId, reference.workspaceId),
                eq(workspaceMembershipsTable.userId, actorUserId),
              ),
            );
          if (workspace.owner !== actorUserId && !membership)
            throw new FormError(
              "NOT_FOUND",
              "Your workspace access was removed. Request a new invitation.",
            );
          return { workspaceId: reference.workspaceId };
        }
        if (workspace.owner !== actorUserId)
          await transaction
            .insert(workspaceMembershipsTable)
            .values({
              workspaceId: reference.workspaceId,
              userId: actorUserId,
              role: invitation.role,
            })
            .onConflictDoNothing();
        await transaction
          .update(workspaceInvitationsTable)
          .set({ acceptedAt: new Date(), acceptedBy: actorUserId })
          .where(eq(workspaceInvitationsTable.id, reference.id));
        await transaction.insert(workspaceAuditEventsTable).values({
          workspaceId: reference.workspaceId,
          actorUserId,
          action: "member.joined",
          entityType: "user",
          entityId: actorUserId,
        });
        return { workspaceId: reference.workspaceId };
      },
      actorUserId,
    );
  }
}
