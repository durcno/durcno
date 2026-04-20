import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "..",
    maxWorkers: process.env.VITEST_MAX_WORKERS ?? undefined,
    globalSetup: "./global-setup.ts",
  },
});
