-- Discovery exposes only the authenticated actor's workspace directory.
-- Trusted server code supplies actor_user_id; it is never accepted from API input.
-- These policies are disabled inside a workspace-scoped transaction.
CREATE POLICY actor_membership_discovery ON builder.workspace_memberships
  FOR SELECT TO builder_runtime
  USING (
    NULLIF(current_setting('app.workspace_id', true), '') IS NULL
    AND user_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
  );
--> statement-breakpoint
CREATE POLICY actor_workspace_discovery ON builder.workspaces
  FOR SELECT TO builder_runtime
  USING (
    NULLIF(current_setting('app.workspace_id', true), '') IS NULL
    AND deleted_at IS NULL
    AND (
      owner_user_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
      OR EXISTS (
        SELECT 1 FROM builder.workspace_memberships membership
        WHERE membership.workspace_id = workspaces.id
          AND membership.user_id = NULLIF(current_setting('app.actor_user_id', true), '')::uuid
      )
    )
  );
