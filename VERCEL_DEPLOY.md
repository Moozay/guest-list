# Deploy to Vercel

## Project settings

Import this repository as a Vercel project and set:

- Root Directory: `artifacts/guest-invites`
- Framework Preset: Next.js
- Include source files outside the Root Directory: enabled
- Build Command: `pnpm run build`

The app uses workspace packages and the Express API from outside its Root Directory. The API is exposed at `/api/*` through a Next.js Pages API route, so the browser and API stay on the same origin.

## Environment

Add `NEON_DATABASE_URL` to the Vercel environments where the app will run. Use the PostgreSQL connection string for the active Neon endpoint; a pooled connection string is recommended. Keep this value in Vercel's environment settings, not in source control.

The database must be reachable from Vercel and have the `invites` table. To create or update the table from a machine that can connect to the database, run:

```sh
pnpm --filter @workspace/db run push
```

## Verify

After deployment, `/api/healthz` should return `{"status":"ok"}`. The guest list is served by `/api/invites`; it also requires a working database connection.