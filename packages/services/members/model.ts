import { z } from "zod";
export const memberRoleSchema = z.enum(["ADMIN", "EDITOR", "VIEWER"]);
export const memberScopeSchema = z.strictObject({ workspaceId: z.uuid() });
export const invitationCreateSchema = memberScopeSchema.extend({
  email: z.email().trim().toLowerCase().max(254),
  role: memberRoleSchema,
});
export const memberUpdateSchema = memberScopeSchema.extend({
  userId: z.uuid(),
  role: memberRoleSchema,
});
export const memberRemoveSchema = memberScopeSchema.extend({ userId: z.uuid() });
export const invitationRevokeSchema = memberScopeSchema.extend({ invitationId: z.uuid() });
export const invitationAcceptSchema = z.strictObject({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const teamSchema = z.strictObject({
  canManage: z.boolean(),
  members: z.array(
    z.strictObject({
      userId: z.uuid(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["OWNER", "ADMIN", "EDITOR", "VIEWER"]),
    }),
  ),
  invitations: z.array(
    z.strictObject({
      id: z.uuid(),
      email: z.string(),
      role: memberRoleSchema,
      expiresAt: z.string(),
    }),
  ),
});
export type Team = z.infer<typeof teamSchema>;
