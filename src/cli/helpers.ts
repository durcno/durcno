import { resolve } from "node:path";

import type { Config, DurcnoSetup } from "..";
import type { Connector } from "../connectors/common";
import { DURCNO_CONFIG_NAME } from "./consts";

export function getUrlFromDbCredentials(
  dbCredentials: Config["dbCredentials"],
) {
  if ("url" in dbCredentials) {
    return dbCredentials.url;
  }

  const { host, port, user, password, database, ssl } = dbCredentials;
  const auth =
    encodeURIComponent(user) +
    (password ? `:${encodeURIComponent(password)}` : "");
  const hostPort = port !== undefined ? `${host}:${port}` : host;
  const url = `postgresql://${auth}@${hostPort}/${encodeURIComponent(database)}`;

  const params: Record<string, string> = {};
  if (ssl !== undefined) {
    if (typeof ssl === "boolean") {
      if (ssl) params.ssl = "true";
    } else if (typeof ssl === "string") {
      params.sslmode = ssl;
    } else if (typeof ssl === "object") {
      throw new Error(
        "Cannot convert 'ssl' ConnectionOptions object into a URL. Provide dbCredentials.url or use a boolean/string ssl value (e.g. 'require').",
      );
    }
  }

  const qs = Object.keys(params).length
    ? `?${Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")}`
    : "";

  return `${url}${qs}`;
}

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

export async function getSetup(argPath?: string): Promise<DurcnoSetup> {
  const absPath = resolveConfigPath(argPath);
  const mod = (await import(absPath)) as { default: DurcnoSetup<Connector> };
  const { default: setup } = mod;
  return setup;
}
