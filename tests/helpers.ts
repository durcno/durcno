import { spawnSync } from "node:child_process";
import fs from "node:fs";
import type { $Client } from "durcno";

export function rmSync(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}

export function runDurcno(
  args: string[],
  env: Record<string, string>,
  cwd?: string,
) {
  const result = spawnSync("pnpm", ["exec", "durcno", ...args], {
    stdio: ["ignore", "ignore", "pipe"],
    env: env,
    cwd: cwd ?? __dirname,
  });
  if (result.stderr?.length) {
    console.error(result.stderr.toString());
  }
  if (result.status !== 0) {
    throw new Error(
      `durcno ${args.join(" ")} failed with exit code ${result.status}`,
    );
  }
}

/**
 * Truncate all tables in the database.
 * Excludes the migrations table by default.
 * Expects an already-connected $Client instance.
 */
export async function truncateTables(
  client: $Client,
  excludeTables: string[] = ["migrations"],
): Promise<void> {
  const exclusions = excludeTables.map((t) => `'${t}'`).join(", ");
  const result = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ${exclusions.length > 0 ? `AND tablename NOT IN (${exclusions})` : ""}
  `);

  const rows = client.getRows(result) as { tablename: string }[];
  await client.query(
    `TRUNCATE TABLE ${rows
      .map((r) => `"${r.tablename}"`)
      .join(", ")} RESTART IDENTITY CASCADE`,
  );
}
