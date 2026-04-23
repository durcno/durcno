import "dotenv/config";
import process from "node:process";
import { defineConfig } from "tsdown";

export default defineConfig({
  tsconfig: "tsconfig.json",
  entry: [
    "src/index.ts",
    "src/migration/index.ts",
    "src/connectors/{bun,pg,postgres,pglite}.ts",
    "src/validators/zod.ts",
  ],
  outDir: "dist/src",
  format: "esm",
  dts: true,
  unbundle: true,
  clean: true,
  sourcemap: process.env.ENV === "development",
  deps: {
    onlyBundle: ["chalk"],
    neverBundle: ["bun", "pg", "postgres", "@electric-sql/pglite", "zod"],
  },
});
