# Worker Watchly (serveur OVH ou équivalent) : planification, contrôles serveur, recherche Web,
# Business (HTTP, HTTPS, scénarios navigateur), e-mails et maintenance.
# Construction (depuis le dossier watchly/) :
#   docker build -f infra/docker/worker.Dockerfile -t watchly-worker .

# --- Étape 1 : dépendances et bundle --------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /src
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/worker/package.json apps/worker/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @watchly/worker... --ignore-scripts
COPY apps/worker/ apps/worker/
RUN pnpm --filter @watchly/worker build

# --- Étape 2 : exécution (Chromium et ses dépendances système inclus) ------------
FROM mcr.microsoft.com/playwright:v1.63.0-noble
ENV NODE_ENV=production
WORKDIR /app
# Dépendances laissées externes par le bundle (versions figées).
RUN npm init -y >/dev/null && npm pkg set type=module && npm install --omit=dev --no-audit --no-fund playwright@1.63.0 pino@10 postgres@3 && npm cache clean --force
COPY --from=build /src/apps/worker/dist/ ./dist/
# Utilisateur non privilégié fourni par l'image Playwright.
USER pwuser
CMD ["node", "--enable-source-maps", "dist/index.js"]
