FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3000
EXPOSE 3000
# DATABASE_URL doit pointer vers un Postgres.
CMD ["sh", "-c", "node scripts/migrate.js && node server/dev.js"]
