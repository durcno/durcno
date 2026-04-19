import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createChangelogGenerator,
  createChangelogSaver,
  createFormatter,
  createGitHubReleaser,
  createNpmPublisher,
  type DirtyFileAbsPath,
  defineConfig,
} from "cngpac";
import { glob } from "glob";

export default defineConfig({
  package: "package.json",
  repository: {
    owner: "durcno",
    name: "durcno",
  },
  changelog: {
    generator: createChangelogGenerator({
      githubToken: process.env.GITHUB_TOKEN || "",
    }),
    saver: createChangelogSaver({
      filepath: "website/releases/v{version}.md",
    }),
  },
  preStage: [
    async ({ configDir, versionBump }) => {
      const src = join(configDir, "website/docs");
      const dest = join(configDir, "website/versioned_docs/version-latest");

      await rm(dest, { recursive: true, force: true });
      await cp(src, dest, { recursive: true, force: true });

      const versionsInfoPath = join(configDir, "website/versionsInfo.json");
      const versionsInfo = JSON.parse(
        await readFile(versionsInfoPath, "utf-8"),
      );
      versionsInfo.latest.label = `Latest - ${versionBump.newVersion}`;
      await writeFile(versionsInfoPath, JSON.stringify(versionsInfo, null, 2));

      const files = await glob("**/*", {
        cwd: dest,
        nodir: true,
        absolute: true,
      });
      return [...files, versionsInfoPath] as unknown as DirtyFileAbsPath[];
    },
  ],
  formatters: [
    createFormatter({ extensions: ["json"], command: "biome format --write" }),
    createFormatter({ extensions: ["md"], command: "oxfmt" }),
  ],
  publishers: [
    createNpmPublisher({
      provenance: true,
    }),
  ],
  releasers: [
    createGitHubReleaser({
      token: process.env.GITHUB_TOKEN || "",
    }),
  ],
});
