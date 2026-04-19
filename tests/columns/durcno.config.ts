import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

// Read from environment variables for test flexibility
export default defineConfig(PgConnector, {
  schema: "./schema.ts",
  out: process.env.MIGRATIONS_DIR,
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "testuser",
    password: process.env.DB_PASSWORD || "testpassword",
    database: process.env.DB_NAME || "testdb",
  },
});
