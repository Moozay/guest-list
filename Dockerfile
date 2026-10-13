FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server build

FROM node:24-bookworm-slim AS api

WORKDIR /app
ENV NODE_ENV=production PORT=5000
COPY --from=build /app /app
EXPOSE 5000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

FROM build AS frontend

ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@workspace/guest-invites", "dev"]

FROM nginx:1.27-alpine AS web

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80