FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build
RUN pnpm --filter @workspace/guest-invites build
RUN chown -R node:node artifacts/guest-invites/.next

FROM node:24-bookworm-slim AS api

WORKDIR /app
ENV NODE_ENV=production PORT=5000
COPY --from=build /app /app
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/api/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
USER node
EXPOSE 5000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

FROM build AS frontend

WORKDIR /app/artifacts/guest-invites
ENV NODE_ENV=production PORT=3000 NEXT_TELEMETRY_DISABLED=1
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]

FROM nginx:1.27-alpine AS web

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80