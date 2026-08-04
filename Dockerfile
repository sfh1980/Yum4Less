# Yum4Less production image — Next.js standalone output.
# Node major matches CI (.github/workflows/ci.yml node-version: 22).
# package.json has no engines pin; keep this ARG in sync with CI.
ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# deps — install all dependencies (including build tooling)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder — compile Next.js standalone bundle
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Client analytics flag is inlined at build time (runtime env alone is not enough).
# CI publish-image passes NEXT_PUBLIC_YUM4LESS_ANALYTICS=1 for :homelab / SHA tags.
ARG NEXT_PUBLIC_YUM4LESS_ANALYTICS=
ENV NEXT_PUBLIC_YUM4LESS_ANALYTICS=$NEXT_PUBLIC_YUM4LESS_ANALYTICS

RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime (no npm, no devDependencies)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p public .next \
  && chown -R node:node /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

# Liveness: HTTP 200 from the app process (no curl/wget in slim image).
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
