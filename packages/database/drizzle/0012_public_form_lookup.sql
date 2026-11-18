-- Only trusted server code sets this slug to resolve the tenant for public intake.
-- No anonymous database role or unscoped definition/answer access is granted.
CREATE POLICY public_form_slug_lookup ON builder.forms
  FOR SELECT TO builder_runtime
  USING (
    NULLIF(current_setting('app.workspace_id', true), '') IS NULL
    AND NULLIF(current_setting('app.actor_user_id', true), '') IS NULL
    AND slug = NULLIF(current_setting('app.public_form_slug', true), '')
    AND deleted_at IS NULL
  );
