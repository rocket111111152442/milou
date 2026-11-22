# Worker Waverti : planification, contrôles serveur, recherche Web, Business (HTTP, HTTPS,
# scénarios navigateur), e-mails et maintenance. Ce Dockerfile ne concerne QUE le worker
# (le site est construit par Vercel, qui l'ignore).
# Placé à la racine de waverti/ pour être détecté automatiquement par Railway (Root Directory = waverti).
# Construction (depuis le dossier waverti/) :
#   docker build -t waverti-worker .

# --- Étape 1 : dépendances et bundle --------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /src
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/worker/package.json apps/worker/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @waverti/worker... --ignore-scripts
COPY apps/worker/ apps/worker/
RUN pnpm --filter @waverti/worker build

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
