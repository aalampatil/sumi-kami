# Sumikami web

The Next.js application provides the public landing page, Clerk sign-in/up, and the protected workspace dashboard at `http://localhost:3001/dashboard`. Workspace creation, discovery, detail, name/retention settings, and product light/dark mode are implemented. Form-builder and respondent screens follow.

Run these commands from the repository root after configuring the development database and matching Clerk environment files:

```sh
pnpm --filter @repo/database db:setup:workspaces
pnpm dev:auth
```

The API listens at `http://localhost:8000`. Browser and server-side clients forward Clerk session tokens to the independently authenticated Express API. Workspace permissions are enforced by services, with a separate restricted runtime database connection.

Pages compose focused components from `components/dashboard` and `components/workspaces`. Shared controls live in `components/ui`. Product tokens live in `styles/product-tokens.css`; published form appearance will be a separate versioned system. The app currently bundles Geist Sans and Geist Mono as interim fonts.

```sh
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
pnpm --filter web test:auth:e2e
```

Browser tests require the running apps, installed Chrome, and development Clerk keys. They retain synthetic test accounts and local workspace fixtures. Environment files, screenshots, and generated output stay out of Git.

See [workspace architecture and setup](../../docs/workspaces.md), [Clerk configuration](../../docs/auth/clerk-setup.md), and the [project plan](../../docs/project-plan.md).
