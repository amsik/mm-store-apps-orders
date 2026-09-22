# Multi-stage build: compile the Vite static bundle, then serve it from an nginx image that
# already runs as a non-root user (nginxinc/nginx-unprivileged listens on 8080, not 80).
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# Also focuses the root workspace: its devDependencies (vite, typescript) are what `run -T` resolves.
RUN yarn workspaces focus @app/web mm-store-apps-orders
COPY tsconfig.base.json ./
COPY apps/web apps/web
# Baked into the bundle at build time: the browser calls this URL directly (no server-side proxy).
ARG VITE_API_URL=http://localhost:3000/graphql
ENV VITE_API_URL=${VITE_API_URL}
RUN yarn workspace @app/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
# 127.0.0.1, not localhost: nginx only binds IPv4, and busybox wget tries ::1 first.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
