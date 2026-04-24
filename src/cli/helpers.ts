import { resolve } from "node:path";

import type { Config } from "..";
import type { Connector } from "../connectors/common";
import { DURCNO_CONFIG_NAME } from "./consts";

export function resolveConfigPath(argPath?: string): string {
  // Accepts an absolute path, a relative path (with or without "./" prefix),
  // or undefined. Always returns an absolute path pointing at the config file.
  if (argPath) {
    // Node's path.resolve handles both absolute and relative paths gracefully.
    return resolve(process.cwd(), argPath);
  }
  // default location when nothing is provided
  return resolve(process.cwd(), DURCNO_CONFIG_NAME);
}

export async function loadConfig(absPath: string): Promise<Config> {
  const mod = (await import(absPath)) as { default: Config<Connector> };
  return mod.default;
}
