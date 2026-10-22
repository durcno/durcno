// @ts-check
import { defineConfig } from "durcno";
import { pglite } from "durcno/connectors/pglite";

export default defineConfig({
  schema: "schema.ts",
  out: "./migrations.test",
  connector: pglite({
    dbCredentials: {
      url: process.env.PGLITE_DB_PATH ?? ":memory:",
    },
  }),
});
