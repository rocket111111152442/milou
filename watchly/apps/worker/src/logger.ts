import pino from "pino";

/** Journaux JSON sans secrets ni données personnelles (adresses e-mail, jetons, en-têtes d'authentification). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "watchly-worker" },
  redact: {
    paths: ["*.password", "*.token", "*.authorization", "*.apiKey", "*.email", "*.to", "*.headers", "DATABASE_URL", "*.claimToken"],
    censor: "[redacted]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
