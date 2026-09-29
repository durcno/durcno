import { defineConfig } from "vitest/config";

/**
 * Standalone config for `vitest bench` (see `perf/`). Kept away from the
 * integration suite so benchmark runs never trigger the Docker-backed global
 * database of `tests/global-setup.ts`.
 */
export default defineConfig({
  test: {
    benchmark: {
      include: ["*.bench.ts"],
    },
  },
});
