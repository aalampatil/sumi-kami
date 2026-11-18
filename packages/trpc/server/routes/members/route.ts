import { z } from "zod";
import { MemberService } from "@repo/services/members";
import {
  invitationAcceptSchema,
  invitationCreateSchema,
  invitationRevokeSchema,
  memberRemoveSchema,
  memberScopeSchema,
  memberUpdateSchema,
  teamSchema,
} from "@repo/services/members/model";
import { protectedProcedure, router, TRPCError } from "../../trpc";
import { formOperation } from "../forms/errors";
import { enforceRateLimit } from "../../utils/rate-limit";
const members = new MemberService(),
  success = z.strictObject({ success: z.literal(true) });
const route = (suffix: string): `/${string}` => `/workspaces/{workspaceId}${suffix}`;
export const membersRouter = router({
  list: protectedProcedure
    .meta({ openapi: { method: "GET", path: route("/members"), tags: ["Team"], protect: true } })
    .input(memberScopeSchema)
    .output(teamSchema)
    .query(({ ctx, input }) => formOperation(() => members.list(ctx.user.id, input))),
  invite: protectedProcedure
    .meta({
      openapi: { method: "POST", path: route("/invitations"), tags: ["Team"], protect: true },
    })
    .input(invitationCreateSchema)
    .output(z.strictObject({ token: z.string() }))
    .mutation(({ ctx, input }) => formOperation(() => members.invite(ctx.user.id, input))),
  update: protectedProcedure
    .meta({
      openapi: { method: "PATCH", path: route("/members/{userId}"), tags: ["Team"], protect: true },
    })
    .input(memberUpdateSchema)
    .output(success)
    .mutation(({ ctx, input }) => formOperation(() => members.update(ctx.user.id, input))),
  remove: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: route("/members/{userId}"),
        tags: ["Team"],
        protect: true,
      },
    })
    .input(memberRemoveSchema)
    .output(success)
    .mutation(({ ctx, input }) => formOperation(() => members.remove(ctx.user.id, input))),
  revoke: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: route("/invitations/{invitationId}"),
        tags: ["Team"],
        protect: true,
      },
    })
    .input(invitationRevokeSchema)
    .output(success)
    .mutation(({ ctx, input }) => formOperation(() => members.revoke(ctx.user.id, input))),
  accept: protectedProcedure
    .meta({
      openapi: { method: "POST", path: "/invitations/accept", tags: ["Team"], protect: true },
    })
    .input(invitationAcceptSchema)
    .output(memberScopeSchema)
    .mutation(({ ctx, input }) => {
      if (!enforceRateLimit({ key: "invite-accept:" + ctx.user.id, limit: 20, windowMs: 60000 }).ok)
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait before trying another invitation.",
        });
      return formOperation(() => members.accept(ctx.user.id, input));
    }),
});
