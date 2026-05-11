import Docker from "dockerode";
import getPort from "get-port";
import { Client } from "pg";
import { v4 as uuid } from "uuid";
import { type Image, images } from "./images";

export { truncateTables } from "./helpers";

export interface TestContainerInfo {
  container: Docker.Container;
  port: number;
  dbName: string;
  connectionString: string;
}

export interface PostgresContainerOptions {
  /** PostgreSQL image to use, defaults to "postgis/postgis:17-3.5" */
  image?: string;
  /** PostgreSQL user, defaults to "testuser" */
  user?: string;
  /** PostgreSQL password, defaults to "testpassword" */
  password?: string;
  /** Database name, auto-generated if not provided */
  dbName?: string;
  /** Container name prefix, auto-generated if not provided */
  containerNamePrefix?: string;
  /** Max retries for connection wait, defaults to 30 */
  maxRetries?: number;
}

/**
 * Start a PostgreSQL Docker container for testing.
 * By default uses PostGIS image for geographic column support.
 */
export async function startPostgresContainer(
  options: Omit<PostgresContainerOptions, "image"> & {
    image?: Image;
  } = {},
): Promise<TestContainerInfo> {
  const {
    image = images["postgres:18-alpine"],
    user = "testuser",
    password = "testpassword",
    dbName = `testdb_${uuid().replace(/-/g, "")}`,
    containerNamePrefix = "durcno-test",
    maxRetries = 30,
  } = options;

  const docker = new Docker();
  const port = await getPort();

  const container = await docker.createContainer({
    Image: image,
    Env: [
      `POSTGRES_USER=${user}`,
      `POSTGRES_PASSWORD=${password}`,
      `POSTGRES_DB=${dbName}`,
    ],
    name: `${containerNamePrefix}-${uuid()}`,
    HostConfig: {
      PortBindings: {
        "5432/tcp": [{ HostPort: `${port}` }],
      },
      AutoRemove: true,
    },
  });

  await container.start();

  const connectionString = `postgres://${user}:${password}@localhost:${port}/${dbName}`;
  await waitForPostgres(connectionString, maxRetries);

  return {
    container,
    port,
    dbName,
    connectionString,
  };
}

/**
 * Stop and remove a PostgreSQL container
 */
export async function stopPostgresContainer(
  container: Docker.Container,
): Promise<void> {
  try {
    await container.stop();
  } catch {
    // Container might already be stopped
  }
}

/**
 * Wait for PostgreSQL to be ready to accept connections
 */
export async function waitForPostgres(
  connectionString: string,
  maxRetries = 30,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new Client({ connectionString });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(
          `PostgreSQL not ready after ${maxRetries} retries: ${error}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
