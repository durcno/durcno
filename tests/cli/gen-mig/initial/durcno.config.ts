// @ts-check
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig({
  schema: "schema.ts",
  out: "./migrations.test",
  connector: pg({
    dbCredentials: {
      host: "localhost",
      port: process.env.DATABASE_PORT
        ? parseInt(process.env.DATABASE_PORT, 10)
        : 5432,
      user: "testuser",
      password: "testpass",
      database: "testdb",
    },
  }),
});
