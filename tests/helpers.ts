import { spawnSync } from "node:child_process";
import fs from "node:fs";

export function runDurcnoCommand(
  args: string[],
  env: Record<string, string>,
  cwd?: string,
) {
  const result = spawnSync("pnpm", ["exec", "durcno", ...args], {
    stdio: ["inherit", "inherit", "pipe"],
    env: env,
    cwd: cwd ?? process.cwd(),
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

export function rmSync(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}
