# Forms, publishing, responses, and teams

Sumikami now has a connected creator and respondent journey on the existing Next.js, Express/tRPC, and PostgreSQL stack. The public site includes a home page, features page, approach page, and interactive demo, with shared headers and footers. The demo never submits answers.

## Use the product locally

1. Configure matching Clerk development keys in the ignored web and API environment files as described in [Clerk setup](auth/clerk-setup.md).
2. Start the local development PostgreSQL database and install dependencies with `pnpm install`.
3. Run `pnpm --filter @repo/database db:setup:workspaces`. This guarded command accepts only a loopback database ending in `_dev`, applies migrations, and provisions a restricted runtime connection. It rotates that connection’s password, so restart the API after running it.
4. Run `pnpm dev:auth` and open `http://localhost:3001`.
5. Sign in, create or open a workspace, and choose **Create form**. Edit the initial question, add further questions and steps, and preview the form. Use **Save draft** to keep changes or **Publish form** to validate and publish them.
6. Open or copy the share link. Respondents do not need an account. Submit a response and open **Responses** in the creator’s form editor to read it.
7. Use **Edit form** to create another draft. The live version stays unchanged until the next publication; earlier responses retain their original version and labels.

Workspace **Forms**, **Members**, and **Settings** have separate routes. Form editing is no longer the workspace settings screen.

## Code organization

| Location                                                 | Responsibility                                                                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/form-core`                                     | Browser-safe definitions, question configuration, answer validation, conditional evaluation, exact decimal comparison, and versioned appearance presets |
| `packages/services/forms`                                | Draft revision checks, persistence, publication, public intake, private file storage, response retrieval, CSV generation, and reporting                 |
| `packages/services/members`                              | Workspace member roles and invitation lifecycle                                                                                                         |
| `packages/trpc/server/routes/forms`, `public`, `members` | Strict request/response contracts, authentication boundaries, error translation, and shared REST/tRPC procedures                                        |
| `apps/api/src/routes/form-files.ts`                      | Bounded multipart parsing and authenticated attachment download; business rules remain in services                                                      |
| `apps/web/components/forms`                              | Workspace form list, builder, inspectors, shared respondent renderer, results, and response activity                                                    |
| `apps/web/components/workspaces`                         | Workspace navigation, settings, member management, and invitation acceptance                                                                            |
| `apps/web/components/site`                               | Public site brand, header, footer, and hero demonstration                                                                                               |

Public rendering uses an anonymous query client and omits credentials on submission. Authenticated query caches are keyed to the Clerk identity. The browser never selects a trusted actor or unchecked tenant context.

## Definition and publication

Thirteen question types are supported: short/long text, email, number, single/multiple choice, dropdown, checkbox, rating, date, date/time, structured JSON, and file upload. Numeric answers remain decimal strings; JavaScript floating-point conversion does not change their precision.

Definitions support up to 20 steps, 100 questions per step, 200 total questions, 100 choices per question, and 50 conditional rules. The visual editor and API support nested AND, OR, and NOT expressions, with up to 100 condition nodes, 20 entries per group, and 12 nesting levels. Choose when a rule is evaluated separately from the earlier questions it compares. Visibility targets and step routes must point forward; comparisons can use only the source or earlier questions. The editor offers only later route targets and preserves nested expressions across save/publish. Routing is evaluated when its source question is reached, and hidden or skipped answers are excluded from storage.

Draft saves require an expected revision. Competing editors receive a conflict instead of silently overwriting changes. Publication validates the complete definition and atomically freezes the version and switches the form’s published pointer. Later editing clones the definition into a new draft with fresh database IDs and preserved logical question keys.

Japanese Ink, Minimal, Midnight, and custom colors share the respondent renderer with the preview. Appearance is stored as a resolved versioned snapshot. The creator’s dashboard light/dark preference does not change published forms.

Closing a form stops new responses; archiving also prevents editing until it is restored. Neither action removes existing responses. Duplicating creates an independent unpublished draft.

## Public intake and retries

Migration `0012_public_form_lookup` grants a narrow SELECT policy for exact-slug lookup with empty actor/workspace context. Trusted server code resolves the workspace, then checks the live workspace, form, and published version inside a restricted tenant transaction. It does not grant unscoped access to definitions or answers.

Submissions validate required visible questions, types, choices, file ownership, and limits on the server. Answers and attachment links are written before an atomic completion transition. Submissions are pinned to their immutable version.

Optional blank/whitespace-only answers and empty selections are omitted from answer storage. Boolean false and numeric zero remain real answers; meaningful text retains its original spaces. This uses the same answered-state check as validation, so blank optional dates, numbers, choices, and JSON never reach typed storage.

A UUID idempotency key serializes concurrent retries for one form. The server stores a SHA-256 request digest rather than another raw answer snapshot. The same payload returns the original receipt; a changed payload conflicts. A completed retry can recover its receipt after a later publication or closure. New attempts against an outdated version must reload the form. Expired/deleted receipts are unavailable. There is no anonymous save/resume endpoint or public response-directory endpoint.

Inputs and submission remain disabled until their client handlers are hydrated. The server-rendered readiness message explains the JavaScript requirement when controls cannot become available. The native form method is POST, so a fallback submission cannot put answers into the page URL. Required/invalid states and visible keyboard focus are exposed on rating controls as well as ordinary inputs.

Keyboard focus uses a color that contrasts with both the page and control surface, falling back to the form's text color when a custom accent is too close to either background. Builder link navigation, including dashboard sidebar links, warns before discarding unsaved changes. Reloads and full-page navigation use the browser's unload warning; browser-history draft recovery is not implemented.

## Attachments

The API accepts multipart submissions with one `data` JSON field and `file:<questionKey>` file parts. JSON submission remains available for responses without files. File IDs in JSON do not authorize attaching existing objects.

The current private filesystem adapter supports PNG, JPEG, WebP, PDF, and UTF-8 text, determined from bytes rather than the browser’s MIME claim. Files are limited by question settings, with hard limits of five files, 10 MB each, and 20 MB per response. Multipart parsing has bounded fields, parts, sizes, concurrent requests, and rate limits. Files are untrusted downloads; content detection is not malware scanning.

Development storage defaults to `.data/uploads` under the API working directory and is ignored by Git. Set `UPLOAD_DIRECTORY` to an absolute, private persistent directory for production. The directory must be writable only by the application’s operating-system account and must not be served as static assets. Database and file storage need a coordinated backup policy. This adapter requires a shared volume if multiple API instances serve the same data.

Stored object keys are generated UUIDs and do not contain original filenames. File metadata and links carry workspace/version/submission constraints. The authenticated download route checks response-read permission and current response retention, and serves attachments with `nosniff` and `private, no-store` caching. Original names are sanitized and returned through attachment disposition.

Failed database/storage operations roll back response rows and remove newly written bytes. A process crash between writing bytes and committing the transaction can leave an orphan object; reconciliation is an operational requirement before production use. Response expiry immediately excludes answers and downloads from ordinary access, but physical database/file deletion still follows the maintenance procedures in [database operations](database/operations.md). No automatic destructive cleanup job has been enabled.

## Teams

Owners and admins can create invitations, revoke pending invitations, update membership roles, and remove members. Ownership is implicit and cannot be removed or downgraded through membership APIs. Editors build/publish forms and read/export responses. Viewers read forms/responses and download attachments, but cannot edit, invite, or export.

Invitations expire after seven days. Only a SHA-256 hash is stored. The link uses a URL fragment (`/invite#token`) so the token is not sent with the page request or as a normal referrer. The protected acceptance API verifies the current Clerk primary email, including its verified status, against the invitation’s normalized email. It does not trust a caller-supplied email or automatically link identities by email. Concurrent acceptance is transactional and idempotent; a removed member cannot reuse an already accepted link to regain access.

The current invite screen creates a link for the admin to copy and share. It does not send email. Clerk authenticates individual accounts; workspace authorization continues to use the existing PostgreSQL model. Clerk Organizations have not been enabled.

## Responses and export

Responses use cursor pagination and load question/choice labels from each submission’s version. Only live, completed, unexpired responses are listed. Search filters the loaded page and is labelled accordingly.

Activity shows available response totals, the last seven days, 14 daily UTC counts, and counts for up to 50 recent versions with responses. It does not combine question meanings across versions.

**Export this page** exports every answer in the current response page, including rows hidden by page search. Each question is a CSV row with response ID, timestamp, version ID/number, original form title, question key/label/type, and answer. Spreadsheet formula prefixes are escaped. Exports require `responses:export`; read permission alone is insufficient. The API accepts a smaller page limit for unusually large answers and enforces a 5 MB export bound. Exports are never silently truncated.

## Verification

Run `pnpm check-types`, `pnpm lint`, `pnpm build`, `pnpm --filter @repo/form-core test`, and `pnpm --filter @repo/services test:forms:unit` from the root. The web browser suite is `pnpm --filter web test:auth:e2e`; start web/API first with matching Clerk development keys.

PostgreSQL suites require an explicitly configured disposable loopback `TEST_DATABASE_URL` ending in `_test`:

```text
pnpm --filter @repo/services test:forms:db
pnpm --filter @repo/services test:members:db
pnpm --filter @repo/services test:workspaces:db
pnpm --filter @repo/database test:db
```

Each suite creates and drops its own disposable database. Do not supply the application development or production URL as the test target. Browser checks create isolated Clerk development accounts and application data; they never use production keys.

## Remaining production work

Production identity rollout, infrastructure provisioning, shared/object storage integration, crash-orphan reconciliation, scheduled retention deletion, distributed rate limiting, and optional email notifications remain deployment or follow-up capabilities. The local single-process rate limiter is not a distributed quota service. The notification setting retained in the definition contract does not dispatch email; its unfinished toggle is not shown in the product.
