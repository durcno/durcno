import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "..",
    maxWorkers: 4,
    globalSetup: "./global-setup.ts",
  },
});
