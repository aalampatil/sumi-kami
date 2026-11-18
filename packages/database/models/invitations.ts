import { sql } from "drizzle-orm";
import { check, index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { builder, id, workspaceId } from "./common";
import { usersTable } from "./user";
import { workspacesTable } from "./workspaces";
export const workspaceInvitationsTable = builder.table(
  "workspace_invitations",
  {
    id: id(),
    workspaceId: workspaceId().references(() => workspacesTable.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    role: text("role").$type<"ADMIN" | "EDITOR" | "VIEWER">().notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => usersTable.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("invitations_workspace_created_idx").on(t.workspaceId, t.createdAt),
    check("invitations_role_check", sql`${t.role} IN ('ADMIN','EDITOR','VIEWER')`),
    check("invitations_hash_check", sql`${t.tokenHash} ~ '^[a-f0-9]{64}$'`),
    check(
      "invitations_email_check",
      sql`${t.email} = lower(btrim(${t.email})) AND length(${t.email}) BETWEEN 3 AND 254`,
    ),
    check("invitations_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
