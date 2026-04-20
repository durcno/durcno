import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("durcno init", () => {
  const testDir = path.resolve(__dirname, "test-project");
  const configPath = path.resolve(testDir, "durcno.config.ts");
  const schemaPath = path.resolve(testDir, "db/schema.ts");
  const indexPath = path.resolve(testDir, "db/index.ts");

  beforeAll(() => {
    // Clean up test directory before tests
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Run init command with CI mode (prompts will use defaults)
    // We inject defaults via stdin with newlines to accept all prompts
    execSync("durcno init", {
      cwd: testDir,
      stdio: ["pipe", "pipe", "pipe"],
      input: "\n\n\n\n\n\n\n\n", // Accept all defaults (Enter key presses)
      env: { ...process.env, CI: "true" },
    });
  });

  afterAll(() => {
    // Clean up test directory after tests
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should generate config file with pg connector", () => {
    // Verify config file was created
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf8");
    expect(configContent).toContain('import { defineConfig } from "durcno"');
    expect(configContent).toContain(
      'import { pg } from "durcno/connectors/pg"',
    );
    expect(configContent).toContain('schema: "db/schema.ts"');
    expect(configContent).toContain('out: "migrations"');
    expect(configContent).toContain("url: process.env.DATABASE_URL!,");
  });

  it("should generate schema file with example table", () => {
    // Verify schema file was created
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, "utf8");
    expect(schemaContent).toContain('export { Migrations } from "durcno"');
    expect(schemaContent).toContain("table(");
    expect(schemaContent).toContain('"users"');
    expect(schemaContent).toContain("pk()");
    expect(schemaContent).toContain("varchar(");
    expect(schemaContent).toContain("timestamp(");
  });

  it("should generate index file exporting db instance", () => {
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexContent = fs.readFileSync(indexPath, "utf8");
    expect(indexContent).toContain('import { database } from "durcno"');
    expect(indexContent).toContain('import * as schema from "./schema"');
    expect(indexContent).toContain('import setup from "../durcno.config"');
    expect(indexContent).toContain("export const db = database(schema, setup)");
  });
});

describe("durcno init --force", () => {
  const testDir = path.resolve(__dirname, "test-project-force");
  const configPath = path.resolve(testDir, "durcno.config.ts");
  const schemaPath = path.resolve(testDir, "db/schema.ts");

  beforeAll(() => {
    // Clean up and create test directory with existing config
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Create an existing config file
    fs.writeFileSync(configPath, "// existing config");

    // Run init with --force to overwrite
    execSync("durcno init --force", {
      cwd: testDir,
      stdio: ["pipe", "pipe", "pipe"],
      input: "\n\n\n\n\n\n\n\n",
      env: { ...process.env, CI: "true" },
    });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should overwrite existing files with --force flag", () => {
    const configContent = fs.readFileSync(configPath, "utf8");
    // Should have overwritten with new content
    expect(configContent).toContain('import { defineConfig } from "durcno"');
    expect(configContent).not.toContain("// existing config");
  });

  it("should generate schema file", () => {
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, "utf8");
    expect(schemaContent).toContain('export { Migrations } from "durcno"');
  });
});
