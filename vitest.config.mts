import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      APP_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/maps_test",
      AUTH_PROVIDER: "local",
      STORAGE_PROVIDER: "local",
      LOCAL_STORAGE_DIR: ".data/test-uploads",
      EMAIL_PROVIDER: "log",
      RUN_WORKER_IN_PROCESS: "false",
    },
  },
});
