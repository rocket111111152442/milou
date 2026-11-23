import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@antonio/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)) } },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    globalSetup: ["./test/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://antonio:antonio@localhost:5432/antonio_test",
      APP_ENCRYPTION_KEY: "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktdGVzdDE=",
      APP_BASE_URL: "http://localhost:5173",
      NODE_ENV: "test",
    },
  },
});
