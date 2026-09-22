# Multi-stage build: compile with the full (dev) dependency graph, then ship only the
# production node_modules + built dist. Debian slim (not alpine) so Prisma's query engine
# finds the glibc/OpenSSL it needs without extra binaryTargets configuration.
ARG NODE_IMAGE=node:24-slim

# --- base: enable corepack once, shared by every stage below. `openssl` is installed here (not
# just in `runtime`) so `prisma generate` detects the same libssl at generate time that the
# final image has at run time; a mismatch downloads the wrong query engine binary.
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN corepack enable \
  && apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Manifests + the Prisma schema (needed by the `prisma generate` postinstall) copied before
# any install, so dependency layers stay cached while application source keeps changing.
FROM base AS manifests
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json

# --- build: full (dev) deps, compiled TypeScript ---
FROM manifests AS build
RUN yarn workspaces focus @app/api
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN yarn workspace @app/api build

# --- prod-deps: production-only deps in their own layer, install order independent of `build`.
# The `postinstall` (`prisma generate`) needs the `prisma` CLI, a dev dependency this
# --production install won't keep, so it's dropped here; the already-generated client is
# copied from `build` below instead.
FROM manifests AS prod-deps
RUN node -e "const fs=require('node:fs'); const p='apps/api/package.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); delete j.scripts.postinstall; fs.writeFileSync(p, JSON.stringify(j));" \
  && yarn workspaces focus @app/api --production

# --- runtime: non-root, only what the running process needs ---
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app && useradd --system --gid app app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/dist apps/api/dist

USER app
EXPOSE 3000

# No curl/wget in the slim image: ask the GraphQL health query directly with Node's built-in fetch.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch(`http://localhost:${process.env.PORT ?? 3000}/graphql`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'{health{status}}'})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "apps/api/dist/main.js"]
