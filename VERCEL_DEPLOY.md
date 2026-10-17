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

Before enabling the authenticated application, apply the additive authentication and invite-ownership migration to the same database:

```sh
psql "$NEON_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f lib/db/migrations/0001_auth_and_invite_ownership.sql \
  -f lib/db/migrations/0002_persistent_login_attempts.sql
```

Provision the first active event planner account securely before opening the app. Passwords must be stored as scrypt hashes; do not put a plaintext password in SQL, source control, or deployment logs. Event planners can then create and manage staff accounts in the application. Guest list checkers can only use the invite validation and check-in workspace. Existing invites retain a null creator because their historical authors are unknown.

For a new database, build the API and run its one-time bootstrap locally with `EVENT_PLANNER_USERNAME` and `EVENT_PLANNER_PASSWORD` set in the ignored `.env` file (the display name defaults to `Emmanuella`):

```sh
pnpm --filter @workspace/api-server build
node --env-file=.env artifacts/api-server/dist/seed-event-planner.mjs
```

The bootstrap refuses to run if an active event planner already exists and never prints the password or its hash. Remove the bootstrap credentials from `.env` after creating the account.

Authentication uses an eight-hour, HttpOnly, SameSite=Strict session cookie, marked Secure in production. Keep the frontend and `/api` routes on the same HTTPS origin so the browser can send the session cookie.
Set `PG_POOL_MAX=1` only if your chosen PostgreSQL endpoint requires overriding the serverless-safe default; in Vercel the pool defaults to one connection per function instance. Failed sign-in attempts are rate-limited in PostgreSQL and expire after 15 minutes.
HSTS is sent only for HTTPS traffic: Vercel sets it on its HTTPS deployment, the API enables it when Vercel forwards HTTPS, and Docker Nginx enables it only when the trusted ingress forwards HTTPS.

For Docker deployments, `docker compose up --build -d` builds and runs the Next.js production server, API, and Nginx proxy. Health checks wait for the database-backed API and frontend before marking the web service ready. The published web port binds to localhost. For external access, place it behind one trusted TLS-terminating reverse proxy that forwards the original `X-Forwarded-Proto: https` and client address in `X-Forwarded-For`; Nginx preserves a validated HTTP/HTTPS scheme for the API origin check. The API trusts two proxy hops (Nginx and that ingress) when determining the client IP for rate limiting. Set `TRUST_PROXY_HOPS` to the actual trusted proxy count if the network path differs. Do not expose the Docker web port directly to untrusted clients.

## Verify

After deployment, `/api/healthz` should return `{"status":"ok"}`. The staff sign-in page is available at `/`; the invites and account-management APIs require an authenticated event planner. The check-in APIs accept either staff role.