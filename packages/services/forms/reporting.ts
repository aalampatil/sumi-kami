import { and, desc, eq, isNull, sql, type TenantDatabase } from "@repo/database";
import { getTenantDatabase } from "@repo/database/runtime";
import { formSubmissionsTable, formVersionsTable } from "@repo/database/schema";
import { withWorkspaceAccess } from "../workspaces/access";
import { lockedForm } from "./index";
import { formScopeSchema } from "./model";
export class FormReportingService {
  constructor(private readonly database: () => TenantDatabase = getTenantDatabase) {}
  async summary(actorUserId: string, request: { workspaceId: string; formId: string }) {
    const input = formScopeSchema.parse(request);
    return withWorkspaceAccess(
      this.database(),
      actorUserId,
      input.workspaceId,
      "responses:read",
      async (transaction) => {
        await lockedForm(transaction, input.workspaceId, input.formId, "share");
        const live = and(
          eq(formSubmissionsTable.workspaceId, input.workspaceId),
          eq(formSubmissionsTable.formId, input.formId),
          eq(formSubmissionsTable.status, "COMPLETED"),
          isNull(formSubmissionsTable.deletedAt),
          sql`(${formSubmissionsTable.expiresAt} IS NULL OR ${formSubmissionsTable.expiresAt}>clock_timestamp())`,
        );
        const [totals] = await transaction
          .select({
            total: sql<number>`count(*)::int`,
            recent: sql<number>`(count(*) FILTER (WHERE ${formSubmissionsTable.completedAt}>=clock_timestamp()-interval '7 days'))::int`,
          })
          .from(formSubmissionsTable)
          .where(live);
        const date = sql<string>`to_char(${formSubmissionsTable.completedAt} AT TIME ZONE 'UTC','YYYY-MM-DD')`;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        start.setUTCDate(start.getUTCDate() - 13);
        const days = await transaction
          .select({ date, count: sql<number>`count(*)::int` })
          .from(formSubmissionsTable)
          .where(
            and(
              live,
              sql`${formSubmissionsTable.completedAt}>=${start.toISOString()}::timestamptz`,
            ),
          )
          .groupBy(date);
        const versions = await transaction
          .select({
            versionNumber: formVersionsTable.versionNumber,
            title: formVersionsTable.title,
            count: sql<number>`count(*)::int`,
          })
          .from(formSubmissionsTable)
          .innerJoin(
            formVersionsTable,
            and(
              eq(formVersionsTable.workspaceId, formSubmissionsTable.workspaceId),
              eq(formVersionsTable.id, formSubmissionsTable.versionId),
            ),
          )
          .where(live)
          .groupBy(formVersionsTable.versionNumber, formVersionsTable.title)
          .orderBy(desc(formVersionsTable.versionNumber))
          .limit(50);
        return {
          ...totals!,
          daily: Array.from({ length: 14 }, (_, index) => {
            const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
            return { date, count: days.find((day) => day.date === date)?.count ?? 0 };
          }),
          versions,
        };
      },
    );
  }
}
