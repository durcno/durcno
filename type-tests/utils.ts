import { type Config, defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

// biome-ignore lint/correctness/noUnusedVariables: <>
export function Expect<T extends true>() {}

export type Equal<X, Y extends X> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

export const testConfig: Config = {
  schema: "db/schema.ts",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "testuser",
    password: "testpass",
    database: "testdb",
  },
};

export const testSetup = defineConfig(pg(), testConfig);
