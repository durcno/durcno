// @ts-check
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  schema: "schema.ts",
  out: "./migrations.test",
  dbCredentials: {
    host: "localhost",
    port: process.env.DATABASE_PORT
      ? parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    user: "testuser",
    password: "testpass",
    database: "testdb",
  },
});
