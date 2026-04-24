import { type Config, type ConnectorOptions, defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

// biome-ignore lint/correctness/noUnusedVariables: <>
export function Expect<T extends true>() {}

export type Equal<X, Y extends X> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

export const testConnectorOptions: ConnectorOptions = {
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "testuser",
    password: "testpass",
    database: "testdb",
  },
};

export const testConfig: Config<ReturnType<typeof pg>> = {
  schema: "db/schema.ts",
  connector: pg(testConnectorOptions),
};

export const testSetup = defineConfig(testConfig);
