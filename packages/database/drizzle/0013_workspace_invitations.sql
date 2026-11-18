CREATE TABLE "builder"."workspace_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "workspace_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_role_check" CHECK ("builder"."workspace_invitations"."role" IN ('ADMIN','EDITOR','VIEWER')),
	CONSTRAINT "invitations_hash_check" CHECK ("builder"."workspace_invitations"."token_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "invitations_email_check" CHECK ("builder"."workspace_invitations"."email" = lower(btrim("builder"."workspace_invitations"."email")) AND length("builder"."workspace_invitations"."email") BETWEEN 3 AND 254),
	CONSTRAINT "invitations_expiry_check" CHECK ("builder"."workspace_invitations"."expires_at" > "builder"."workspace_invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "builder"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "builder"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder"."workspace_invitations" ADD CONSTRAINT "workspace_invitations_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_workspace_created_idx" ON "builder"."workspace_invitations" USING btree ("workspace_id","created_at");
--> statement-breakpoint
ALTER TABLE builder.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE builder.workspace_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON builder.workspace_invitations
  USING (workspace_id = NULLIF(current_setting('app.workspace_id',true),'')::uuid)
  WITH CHECK (workspace_id = NULLIF(current_setting('app.workspace_id',true),'')::uuid);
CREATE POLICY invitation_token_lookup ON builder.workspace_invitations FOR SELECT TO builder_runtime
  USING (
    NULLIF(current_setting('app.workspace_id',true),'') IS NULL
    AND NULLIF(current_setting('app.actor_user_id',true),'') IS NULL
    AND token_hash = NULLIF(current_setting('app.invitation_hash',true),'')
  );
REVOKE ALL ON builder.workspace_invitations FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON builder.workspace_invitations TO builder_runtime,builder_maintenance;
