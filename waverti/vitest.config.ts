import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          sequence: { groupOrder: 0 },
          include: ["packages/**/test/**/*.unit.test.ts", "apps/**/test/**/*.unit.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          sequence: { groupOrder: 1 },
          include: ["packages/**/test/**/*.int.test.ts", "apps/**/test/**/*.int.test.ts"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // Chaque fichier crée sa propre base : on limite le parallélisme pour ménager PostgreSQL.
          maxWorkers: 4,
        },
      },
      // Tests de charge : lancés explicitement (pnpm test:load), jamais dans la suite par défaut.
      ...(process.env.WAVERTI_LOAD_TESTS === "1"
        ? [
            {
              test: {
                name: "load",
                sequence: { groupOrder: 2 },
                include: ["packages/**/test/**/*.load.test.ts"],
                environment: "node",
                testTimeout: 600_000,
                hookTimeout: 300_000,
                maxWorkers: 1,
              },
            },
          ]
        : []),
    ],
  },
});
