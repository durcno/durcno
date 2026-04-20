import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig(pg(), {
  schema: "./schema.ts",
  out: "./migrations.test",
  dbCredentials: {
    host: "localhost",
    port: process.env.DATABASE_PORT
      ? parseInt(process.env.DATABASE_PORT, 10)
      : 5432,
    user: "testuser",
    password: "testpassword",
    database: process.env.DB_NAME || "testdb",
  },
});
