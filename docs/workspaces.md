# Workspace foundation

Sumikami's first application slice adds workspace creation, discovery, detail, and settings to the existing Clerk and PostgreSQL baseline. A signed-in creator can create a workspace, return to it from the dashboard, change its name and default response retention, and switch product light/dark mode. Form drafting, publication, public intake, response screens, and team invitations remain the next milestones.

## Code organization

| Location                                                             | Responsibility                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/database/runtime-config.ts`, `runtime.ts`                  | Validate and lazily open the dedicated runtime connection                   |
| `packages/database/runtime-security.ts`, `tenant.ts`, `discovery.ts` | Reject elevated connections and set transaction-local actor/workspace scope |
| `packages/database/drizzle/0011_workspace_discovery.sql`             | Actor-scoped directory policies; no new tables or rewritten migrations      |
| `packages/services/workspaces/model.ts`                              | Strict editable input and safe response contracts                           |
| `packages/services/workspaces/permissions.ts`                        | Workspace capabilities, independent of platform roles                       |
| `packages/services/workspaces/access.ts`                             | Discovery and transactional authorization with live role rechecks           |
| `packages/services/workspaces/queries.ts`                            | Shared projections and effective-role expressions                           |
| `packages/services/workspaces/index.ts`, `errors.ts`                 | Transactional operations and transport-independent errors                   |
| `packages/trpc/server/routes/workspaces`                             | Protected tRPC/REST adapters and safe error translation                     |
| `apps/web/components/workspaces`, `components/dashboard`             | Workspace interaction and dashboard composition                             |
| `apps/web/styles/product-tokens.css`                                 | Central product colors; separate from future published form appearance      |

The browser receives neither a database connection nor editable ownership/role fields. Services accept the verified local UUID separately from the validated request. API routes select that UUID from authenticated context.

`@repo/trpc/client` exposes shared types only. The web app imports links, proxy clients, and client-error classes directly from its own `@trpc/client` dependency so the transport and React Query hooks use one runtime. Crossing pnpm peer variants of that client can strip typed error metadata. Workspace controls also wait for Clerk identity readiness before accepting input, preserving dialog state when the identity-scoped provider initializes after a reload.

## Authorization

| Capability                | Owner | Admin | Editor | Viewer |
| ------------------------- | ----- | ----- | ------ | ------ |
| Read workspace            | Yes   | Yes   | Yes    | Yes    |
| Update workspace settings | Yes   | Yes   | No     | No     |
| Manage members            | Yes   | Yes   | No     | No     |
| Read forms                | Yes   | Yes   | Yes    | Yes    |
| Edit and publish forms    | Yes   | Yes   | Yes    | No     |
| Read responses            | Yes   | Yes   | Yes    | Yes    |
| Export responses          | Yes   | Yes   | Yes    | No     |

The matrix is the service capability contract; only workspace read/create/update routes are implemented here. It does not expose member management, forms, publication, results, or export features. Ownership is implicit and overrides a lower membership role. The global `users.role = ADMIN` grants no workspace membership.

Unknown, deleted, and unauthorized workspaces return the same not-found response. A known member lacking an operation's capability receives forbidden. Settings updates rediscover access, open a scoped transaction, lock the workspace, recheck the live membership under a lock, and then write. Revoked or downgraded permissions cannot rely solely on an earlier discovery result.

## Runtime database boundaries

`DATABASE_URL` continues to serve the existing identity connection. Set `TENANT_DATABASE_URL` to a separate non-owner login inheriting `builder_runtime`; it must not inherit `builder_maintenance` or own the builder schema/tables. Tenant requests never fall back to the identity or migration credential. Connections are initialized lazily, so public health and identity endpoints do not require the tenant pool.

Migration `0011` adds SELECT-only directory policies to workspaces and memberships. With no workspace context, the authenticated actor can discover active workspaces they own or joined, and their own membership rows. These policies are disabled when a workspace context is present. Form definitions, submissions, answers, and audit records retain their workspace-only policies.

`withWorkspaceDiscovery` clears workspace context and supplies the actor using transaction-local settings. `withAuthorizedWorkspace` supplies workspace and actor context. Both verify the connection and reset context through transaction completion or rollback. Actor IDs are trusted server inputs, not credentials: anyone holding runtime SQL credentials can choose settings, so those credentials must stay server-side.

Creation is the deliberate bootstrap exception: the server generates a new workspace UUID, establishes that scope, and inserts the authenticated actor as owner. PostgreSQL records audit attribution in the same transaction. No membership row is required for the owner.

## Local setup

Start the documented development database, configure the existing API and web Clerk environment files, then run:

```sh
pnpm --filter @repo/database db:setup:workspaces
pnpm dev:auth
```

The setup command reads `apps/api/.env.local`, accepts only a loopback PostgreSQL database ending in `_dev`, applies pending migrations there, provisions a restricted login, verifies it, and writes only its runtime connection setting to that ignored file. It prints no credentials. Running it again rotates that local login's password; restart the API afterward. It does not provision production resources.

Root `build` and `dev` commands delegate to Turbo without loading the root `.env` into every app. Next.js loads the web environment; the API explicitly loads its own local file without variable expansion; database Studio explicitly loads the root database configuration. This prevents an older root Clerk instance from overriding the web app's keys at build time. Keep build and runtime public authentication settings consistent.

Open `http://localhost:3001/dashboard`, sign in, and choose **Create workspace**. Names may contain Unicode. Addresses use lowercase ASCII letters, numbers, and single hyphens, are globally unique, and remain stable when the display name changes. Non-Latin names can use an explicit address.

Production needs separately provisioned identity/runtime/migration logins, migration `0011` after all prerequisites, real Clerk keys/origins, and deployment secret configuration. Follow the existing database and Clerk rollout guides. Local setup does not migrate production or perform an identity cutover.

## API

| tRPC procedure      | REST operation                        | Input                                                     |
| ------------------- | ------------------------------------- | --------------------------------------------------------- |
| `workspaces.list`   | `GET /api/workspaces`                 | Optional `limit`, paired `cursorCreatedAt` and `cursorId` |
| `workspaces.create` | `POST /api/workspaces`                | `name`, `slug`                                            |
| `workspaces.get`    | `GET /api/workspaces/{workspaceId}`   | Workspace UUID in the path                                |
| `workspaces.update` | `PATCH /api/workspaces/{workspaceId}` | `name`, explicit `retentionDays` or null                  |

All operations require a verified Clerk bearer token. tRPC and REST call the same service code. Editable inputs are strict: ownership, roles, memberships, audit actor, deletion, and creation timestamps cannot be injected through these contracts.

Discovery defaults to 20 results, permits at most 50, and returns `{ items, nextCursor }`. Pass both cursor fields from `nextCursor` to continue. Timestamps retain PostgreSQL microseconds, with UUID ordering to break ties. Passing only one cursor field is invalid.

Retention accepts whole days from 1 to 99999 or explicit null. The value supplies a default for future submissions; changing it does not rewrite existing expiry dates. Existing version-specific retention takes precedence under the database's submission guards. A duplicate address returns conflict without exposing the other workspace.

## Verification commands

```sh
pnpm lint
pnpm check-types
pnpm build
pnpm --filter @repo/services test:workspaces:unit
pnpm --filter @repo/database db:check
```

For integration tests, explicitly set `TEST_DATABASE_URL` to a disposable loopback PostgreSQL database ending in `_test`, with database/role creation privileges:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:<local-password>@127.0.0.1:55433/sumikami_clerk_test'
pnpm --filter @repo/services test:workspaces:db
pnpm --filter @repo/database test:db
pnpm --filter @repo/services test:auth
```

The workspace suite creates a uniquely named database and a real non-owner login, then removes both. Its cases cover ownership, all workspace roles, platform-admin isolation, revocation, deletion, audit attribution, duplicate claims, context reset, privilege denial, and precise pagination. The unit suite covers contracts, the complete role/capability matrix, error translation, runtime configuration, and address suggestions.

After starting the API and web servers:

```sh
pnpm --filter web test:auth:e2e
```

Browser checks use Chrome and the existing Clerk development testing helpers. They create synthetic development accounts and workspace records and retain them locally. Test screenshots are ignored by Git. See the [Clerk testing setup](auth/clerk-setup.md) for instance boundaries.

## Verification record — 2026-11-19

| Check                                                                            | Result     |
| -------------------------------------------------------------------------------- | ---------- |
| Workspace unit regressions                                                       | 107 passed |
| Workspace services through a real restricted PostgreSQL login                    | 31 passed  |
| Existing migration, integrity, lifecycle, and isolation suite                    | 15 passed  |
| Existing Clerk/local identity integration suite                                  | 5 passed   |
| Chrome authentication and workspace journeys                                     | 6 passed   |
| Repository lint, five package type checks, Express and Next.js production builds | Passed     |
| Drizzle journal/snapshot validation                                              | Passed     |

The 164 tests include server-enforced roles, unrelated platform admins, revoked membership, deleted workspaces, audit attribution, racing address claims, precise cursor ties, public/invalid authentication, settings persistence, typed duplicate-address feedback, keyboard dialog focus, mobile reflow, theme persistence, and a second account denied access to the first account's workspace. No assertion was weakened to accommodate a failure. The Node 25/Windows Clerk helper still logs its known shutdown/background-request diagnostics; the final Playwright run reports six passing tests and exits successfully.

Browser verification caught and corrected a navigation race in the test, interactive state resetting before Clerk identity readiness, root environment settings overriding app-specific build keys, and duplicate tRPC client runtimes stripping typed error metadata. Runtime and migration checks used isolated local resources. Production data and authentication cutover were untouched.

## Next slice

Build draft-form services and a small editor on this authorization layer. Keep revision checks, publication validation, and immutable historical versions in services and transactions. Add respondent intake only once pinned-version answer validation and anonymous continuation authorization are defined.
