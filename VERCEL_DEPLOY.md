# Deploy to Vercel Services

## Project settings

Import the repository root (`.`) as a Vercel project. The root `vercel.json` defines two services:

- `guest-invites`: the Next.js frontend, publicly routed at `/`
- `api-server`: the Express API, publicly routed at `/api/*`

The rewrite preserves the original request path, which matches the API's existing `/api` route prefix. The mockup sandbox and Docker/Nginx stack are not deployed as Vercel services.

## Environment

Add `NEON_DATABASE_URL` to the Vercel Production and Preview environments. Use the PostgreSQL connection string for the active Neon endpoint; a pooled connection string is recommended. Keep this value in Vercel's environment settings, not in source control.

The database must be reachable from Vercel and have the `invites` table. To create or update the table from a machine that can connect to the database, run:

```sh
pnpm --filter @workspace/db run push
```

## Verify

After deployment, `/api/healthz` should return `{"status":"ok"}`. The guest list is served by `/api/invites`; it also requires a working database connection.