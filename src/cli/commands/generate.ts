import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import chalk from "chalk";
import {
  createEmptySnapshot,
  type DDLStatement,
  type MigrationOptions,
  snapshot,
} from "durcno/migration";
import prompts from "prompts";
import type { Connector } from "../../connectors/common";
import type {
  Snapshot,
  SnapshotColumn,
  SnapshotTable,
  SnapshotTableIndex,
} from "../../migration/snapshot";
import type { Options } from "..";
import { ensureNoEntityCollisions, getMigrationFolderNames } from "../checks";
import { DEFAULT_MIGRATIONS_DIR, POSTGRES_DEFAULT_SCHEMA } from "../consts";
import { loadConfig, resolveConfigPath } from "../helpers";
import { getOrderedDependencies } from "../utils";

const { cyan, yellow, red, gray, bgGreen } = chalk;

/** Mapping of `"schema.oldName"` to `"schema.newName"` for renamed tables. */
export interface RenamedTables {
  [oldKey: string]: string;
}

/** Mapping of `"schema.table"` to `{ oldCol: newCol }` for renamed columns. */
export interface RenamedColumns {
  [tableKey: string]: Record<string, string>;
}

export interface GenerateOptions extends Options {
  /** Treat unresolved potential renames as drop + create instead of prompting. */
  yes?: boolean;
  /** Table renames in `schema.old=schema.new` form; the schema defaults to `public`. */
  renameTable?: string[];
  /** Column renames in `schema.table.old=new` form; the schema defaults to `public`. */
  renameColumn?: string[];
}

interface TableRenameCandidate {
  prevKey: string;
  tableSchema: string;
  tableName: string;
  targets: string[];
}

interface ColumnRenameCandidate {
  tableKey: string;
  tableSchema: string;
  tableName: string;
  droppedColumn: string;
  targets: string[];
}

function onCancel() {
  console.log(`${yellow("[QUIT]")} ${gray("Generation cancelled.")}`);
  process.exit(0);
}

function fail(message: string): never {
  console.error(red(`Error: ${message}`));
  process.exit(1);
}

/** Resolves a user-provided table name against snapshot keys, defaulting to `public`. */
function resolveTableKey(
  name: string,
  tables: Record<string, SnapshotTable>,
): string | undefined {
  if (name in tables) return name;
  const withDefaultSchema = `${POSTGRES_DEFAULT_SCHEMA}.${name}`;
  return withDefaultSchema in tables ? withDefaultSchema : undefined;
}

/** Parses repeatable `--rename-table old=new` flags into a rename mapping. */
function parseTableRenames(
  mappings: string[],
  prev: Snapshot,
  curr: Snapshot,
): RenamedTables {
  const renames: RenamedTables = {};

  for (const mapping of mappings) {
    const separator = mapping.indexOf("=");
    if (separator <= 0 || separator === mapping.length - 1) {
      fail(
        `Invalid --rename-table "${mapping}". Expected old=new, e.g. public.users=public.members.`,
      );
    }

    const oldInput = mapping.slice(0, separator).trim();
    const newInput = mapping.slice(separator + 1).trim();
    if (!oldInput || !newInput) {
      fail(
        `Invalid --rename-table "${mapping}". Expected old=new, e.g. public.users=public.members.`,
      );
    }

    const oldKey = resolveTableKey(oldInput, prev.tables);
    const newKey = resolveTableKey(newInput, curr.tables);

    if (!oldKey) {
      fail(`Table "${oldInput}" does not exist in the previous snapshot.`);
    }
    if (!newKey) {
      fail(`Table "${newInput}" does not exist in the current schema.`);
    }
    if (oldKey === newKey) {
      fail(`Table rename "${mapping}" must use different old and new names.`);
    }
    if (oldKey in curr.tables) {
      fail(`Table "${oldKey}" still exists in the current schema.`);
    }
    if (newKey in prev.tables) {
      fail(`Table "${newKey}" already exists in the previous snapshot.`);
    }
    if (prev.tables[oldKey].schema !== curr.tables[newKey].schema) {
      fail(`Table rename "${mapping}" must stay in the same schema.`);
    }
    if (oldKey in renames) {
      fail(`Table "${oldKey}" already has a rename declared.`);
    }
    if (Object.values(renames).includes(newKey)) {
      fail(`Table "${newKey}" is already the target of another rename.`);
    }

    renames[oldKey] = newKey;
  }

  return renames;
}

/** Parses repeatable `--rename-column table.old=new` flags into a rename mapping. */
function parseColumnRenames(
  mappings: string[],
  prev: Snapshot,
  curr: Snapshot,
  renamedTables: RenamedTables,
): RenamedColumns {
  const renames: RenamedColumns = {};

  for (const mapping of mappings) {
    const separator = mapping.indexOf("=");
    if (separator <= 0 || separator === mapping.length - 1) {
      fail(
        `Invalid --rename-column "${mapping}". Expected table.old=new, e.g. public.users.name=full_name.`,
      );
    }

    const source = mapping.slice(0, separator).trim();
    const newColumn = mapping.slice(separator + 1).trim();
    const dot = source.lastIndexOf(".");
    if (!newColumn || dot <= 0 || dot === source.length - 1) {
      fail(
        `Invalid --rename-column "${mapping}". Expected table.old=new, e.g. public.users.name=full_name.`,
      );
    }

    const tableInput = source.slice(0, dot);
    const oldColumn = source.slice(dot + 1);

    let currKey = resolveTableKey(tableInput, curr.tables);
    if (!currKey) {
      const prevKey = resolveTableKey(tableInput, prev.tables);
      if (prevKey && renamedTables[prevKey]) {
        currKey = renamedTables[prevKey];
      }
    }
    if (!currKey) {
      fail(`Table "${tableInput}" does not exist in the current snapshot.`);
    }

    const prevKey =
      Object.entries(renamedTables).find(
        ([, target]) => target === currKey,
      )?.[0] ?? currKey;
    const prevTable = prev.tables[prevKey];
    const currTable = curr.tables[currKey];

    if (!prevTable) {
      fail(`Table "${tableInput}" does not exist in the previous snapshot.`);
    }
    if (!(oldColumn in prevTable.columns)) {
      fail(
        `Column "${oldColumn}" does not exist in previous table "${prevKey}".`,
      );
    }
    if (!(newColumn in currTable.columns)) {
      fail(
        `Column "${newColumn}" does not exist in current table "${currKey}".`,
      );
    }
    if (oldColumn === newColumn) {
      fail(`Column rename "${mapping}" must use different old and new names.`);
    }
    if (oldColumn in currTable.columns) {
      fail(`Column "${oldColumn}" still exists in current table "${currKey}".`);
    }
    if (newColumn in prevTable.columns) {
      fail(
        `Column "${newColumn}" already exists in previous table "${prevKey}".`,
      );
    }

    if (!renames[currKey]) renames[currKey] = {};
    const tableRenames = renames[currKey];
    if (oldColumn in tableRenames) {
      fail(
        `Column "${oldColumn}" in "${currKey}" already has a rename declared.`,
      );
    }
    if (Object.values(tableRenames).includes(newColumn)) {
      fail(
        `Column "${newColumn}" in "${currKey}" is already the target of another rename.`,
      );
    }

    tableRenames[oldColumn] = newColumn;
  }

  return renames;
}

/**
 * Detects tables that were potentially renamed by comparing dropped and added tables.
 * Explicit renames are excluded so only ambiguous pairs remain.
 */
function findTableRenameCandidates(
  prev: Snapshot,
  curr: Snapshot,
  renamedTables: RenamedTables,
): TableRenameCandidate[] {
  const renamedFrom = new Set(Object.keys(renamedTables));
  const renamedTo = new Set(Object.values(renamedTables));

  const droppedTables = Object.keys(prev.tables).filter(
    (key) => !(key in curr.tables) && !renamedFrom.has(key),
  );
  const addedTables = Object.keys(curr.tables).filter(
    (key) => !(key in prev.tables) && !renamedTo.has(key),
  );

  const candidates: TableRenameCandidate[] = [];
  for (const prevKey of droppedTables) {
    const prevTable = prev.tables[prevKey];
    const targets = addedTables.filter(
      (key) => curr.tables[key].schema === prevTable.schema,
    );
    if (targets.length > 0) {
      candidates.push({
        prevKey,
        tableSchema: prevTable.schema,
        tableName: prevTable.name,
        targets,
      });
    }
  }

  return candidates;
}

/**
 * Detects columns that were potentially renamed by comparing dropped and added columns
 * within tables that exist in both snapshots (accounting for table renames).
 */
function findColumnRenameCandidates(
  prev: Snapshot,
  curr: Snapshot,
  renamedTables: RenamedTables,
  renamedColumns: RenamedColumns,
): ColumnRenameCandidate[] {
  const candidates: ColumnRenameCandidate[] = [];

  for (const prevKey of Object.keys(prev.tables)) {
    const currKey = renamedTables[prevKey] ?? prevKey;
    const currTable = curr.tables[currKey];
    if (!currTable) continue;

    const prevTable = prev.tables[prevKey];
    const columnRenames = renamedColumns[currKey] ?? {};
    const renamedFrom = new Set(Object.keys(columnRenames));
    const renamedTo = new Set(Object.values(columnRenames));

    const droppedColumns = Object.keys(prevTable.columns).filter(
      (name) => !(name in currTable.columns) && !renamedFrom.has(name),
    );
    const addedColumns = Object.keys(currTable.columns).filter(
      (name) => !(name in prevTable.columns) && !renamedTo.has(name),
    );

    if (droppedColumns.length === 0 || addedColumns.length === 0) continue;

    for (const droppedColumn of droppedColumns) {
      candidates.push({
        tableKey: currKey,
        tableSchema: currTable.schema,
        tableName: currTable.name,
        droppedColumn,
        targets: addedColumns,
      });
    }
  }

  return candidates;
}

/** Prompts the user to confirm each potential table rename. */
async function promptTableRenames(
  candidates: TableRenameCandidate[],
  curr: Snapshot,
  renames: RenamedTables,
): Promise<RenamedTables> {
  const claimed = new Set(Object.values(renames));

  for (const candidate of candidates) {
    const targets = candidate.targets.filter((key) => !claimed.has(key));
    if (targets.length === 0) continue;

    const { choice } = await prompts(
      {
        type: "select",
        name: "choice",
        message: `Is the table "${candidate.tableSchema}"."${candidate.tableName}" renamed to?`,
        choices: [
          ...targets.map((key) => ({
            title: curr.tables[key].name,
            value: key,
          })),
          { title: "No, it was deleted", value: "" },
        ],
      },
      { onCancel },
    );

    if (choice) {
      renames[candidate.prevKey] = choice;
      claimed.add(choice);
    }
  }

  return renames;
}

/** Prompts the user to confirm each potential column rename. */
async function promptColumnRenames(
  candidates: ColumnRenameCandidate[],
  renames: RenamedColumns,
): Promise<RenamedColumns> {
  const claimedByTable = new Map<string, Set<string>>();
  for (const [tableKey, columnRenames] of Object.entries(renames)) {
    claimedByTable.set(tableKey, new Set(Object.values(columnRenames)));
  }

  for (const candidate of candidates) {
    const claimed = claimedByTable.get(candidate.tableKey) ?? new Set<string>();
    const targets = candidate.targets.filter((name) => !claimed.has(name));
    if (targets.length === 0) continue;

    const tableName = `"${candidate.tableSchema}"."${candidate.tableName}"`;
    const { choice } = await prompts(
      {
        type: "select",
        name: "choice",
        message: `Is the column "${candidate.droppedColumn}" in ${tableName} renamed to?`,
        choices: [
          ...targets.map((name) => ({ title: name, value: name })),
          { title: "No, it was deleted", value: "" },
        ],
      },
      { onCancel },
    );

    if (choice) {
      if (!renames[candidate.tableKey]) renames[candidate.tableKey] = {};
      renames[candidate.tableKey][candidate.droppedColumn] = choice;
      claimed.add(choice);
      claimedByTable.set(candidate.tableKey, claimed);
    }
  }

  return renames;
}

/** Fails with actionable flags when renames cannot be confirmed non-interactively. */
function failPendingRenames(
  tableCandidates: TableRenameCandidate[],
  columnCandidates: ColumnRenameCandidate[],
): never {
  const lines = ["Potential table/column renames need confirmation.", ""];

  for (const candidate of tableCandidates) {
    const table = `"${candidate.tableSchema}"."${candidate.tableName}"`;
    lines.push(`  table ${table} may be renamed to:`);
    for (const target of candidate.targets) {
      lines.push(`    --rename-table ${candidate.prevKey}=${target}`);
    }
  }

  for (const candidate of columnCandidates) {
    const table = `"${candidate.tableSchema}"."${candidate.tableName}"`;
    lines.push(
      `  column "${candidate.droppedColumn}" in ${table} may be renamed to:`,
    );
    for (const target of candidate.targets) {
      lines.push(
        `    --rename-column ${candidate.tableKey}.${candidate.droppedColumn}=${target}`,
      );
    }
  }

  lines.push(
    "",
    "Re-run with the matching rename flag, or pass --yes to treat them as drop + create.",
  );

  console.error(red(`Error: ${lines[0]}`));
  console.error(lines.slice(1).join("\n"));
  process.exit(1);
}

async function resolveRenames(
  prev: Snapshot,
  curr: Snapshot,
  options: GenerateOptions,
): Promise<{ renamedTables: RenamedTables; renamedColumns: RenamedColumns }> {
  const renamedTables = parseTableRenames(
    options.renameTable ?? [],
    prev,
    curr,
  );
  const renamedColumns = parseColumnRenames(
    options.renameColumn ?? [],
    prev,
    curr,
    renamedTables,
  );

  const tableCandidates = findTableRenameCandidates(prev, curr, renamedTables);
  const interactive =
    !options.yes && process.stdin.isTTY && process.env.CI !== "true";

  if (interactive) {
    await promptTableRenames(tableCandidates, curr, renamedTables);
    const columnCandidates = findColumnRenameCandidates(
      prev,
      curr,
      renamedTables,
      renamedColumns,
    );
    await promptColumnRenames(columnCandidates, renamedColumns);
    return { renamedTables, renamedColumns };
  }

  const columnCandidates = findColumnRenameCandidates(
    prev,
    curr,
    renamedTables,
    renamedColumns,
  );
  if (tableCandidates.length === 0 && columnCandidates.length === 0) {
    return { renamedTables, renamedColumns };
  }

  if (!options.yes) {
    failPendingRenames(tableCandidates, columnCandidates);
  }

  const count = tableCandidates.length + columnCandidates.length;
  console.log(
    yellow(
      `[SKIP] Treating ${count} potential rename${count === 1 ? "" : "s"} as drop + create.`,
    ),
  );

  return { renamedTables, renamedColumns };
}

export async function generate(options: GenerateOptions) {
  const configPath = resolveConfigPath(options.config);
  const config = await loadConfig(configPath);

  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
  }

  const migrationFolderNames = getMigrationFolderNames(migrationsDir);
  const ssPrevious = createEmptySnapshot();

  // Apply all existing migrations to build the previous snapshot
  for (const migrationFolder of migrationFolderNames.sort()) {
    const upTsPath = resolve(migrationsDir, migrationFolder, "up.ts");
    const upModule = await import(upTsPath);
    const statements: DDLStatement[] = upModule.statements;
    for (const statement of statements) {
      statement.applyToSnapshot(ssPrevious);
    }
  }

  const schemaFile = resolve(
    configPath ? dirname(configPath) : process.cwd(),
    config.schema,
  );
  const exports = await import(schemaFile);
  ensureNoEntityCollisions(exports);
  const entities = Object.values(exports);
  const ssCurrent = snapshot(entities);

  const ssCurrentVerify = snapshot(entities);
  if (JSON.stringify(ssCurrent) !== JSON.stringify(ssCurrentVerify)) {
    console.error(
      red(
        "Error: Schema snapshots are inconsistent. Two consecutive snapshots produced different results.",
      ),
    );
    process.exit(1);
  }

  const { renamedTables, renamedColumns } = await resolveRenames(
    ssPrevious,
    ssCurrent,
    options,
  );

  // Read migration option defaults from the connector class (if any)
  const connectorMigrationOpts = (
    config.connector.constructor as typeof Connector
  ).migrationOptions;

  const migrationUpTs = generateMigration(
    ssPrevious,
    ssCurrent,
    "up",
    renamedTables,
    renamedColumns,
    connectorMigrationOpts,
  );

  // Build reverse rename mappings for the down migration
  const reverseRenamedTables: RenamedTables = {};
  for (const [oldKey, newKey] of Object.entries(renamedTables)) {
    reverseRenamedTables[newKey] = oldKey;
  }

  const reverseRenamedColumns: RenamedColumns = {};
  for (const [tableKey, colMap] of Object.entries(renamedColumns)) {
    // Find the prev table key for this curr table key
    const prevKey =
      Object.entries(renamedTables).find(([, v]) => v === tableKey)?.[0] ??
      tableKey;
    reverseRenamedColumns[prevKey] = {};
    for (const [oldCol, newCol] of Object.entries(colMap)) {
      reverseRenamedColumns[prevKey][newCol] = oldCol;
    }
  }

  const migrationDnTs = generateMigration(
    ssCurrent,
    ssPrevious,
    "down",
    reverseRenamedTables,
    reverseRenamedColumns,
    connectorMigrationOpts,
  );

  if (migrationUpTs === null) {
    console.log(yellow("No changes detected. Skipping migration creation."));
    process.exit(0);
  }

  const migrationName: string = new Date().toISOString().replaceAll(":", "-");
  const migrationDir = resolve(migrationsDir, migrationName);
  mkdirSync(migrationDir, { recursive: true });

  writeFileSync(resolve(migrationDir, "up.ts"), migrationUpTs);
  writeFileSync(
    resolve(migrationDir, "down.ts"),
    migrationDnTs ?? generateNoOpMigration(connectorMigrationOpts),
  );

  const migrationsRelativePath = relative(process.cwd(), migrationsDir);
  console.log(
    `${bgGreen.white.bold("[CREATED]")} ${cyan(migrationName)} at ${cyan(`${migrationsRelativePath}/`)}`,
  );
}

/**
 * Generates TypeScript migration file exporting DDL statement objects.
 */
export function generateMigration(
  prev: Snapshot,
  curr: Snapshot,
  direction: "up" | "down",
  renamedTables: RenamedTables = {},
  renamedColumns: RenamedColumns = {},
  defaultOptions?: MigrationOptions,
): string | null {
  const statements: string[] = [];

  // Build a set of table keys that are rename targets (should not be dropped/created)
  const renamedFromKeys = new Set(Object.keys(renamedTables));
  const renamedToKeys = new Set(Object.values(renamedTables));

  const prevSchemas = new Set(
    Object.keys(prev.tables).map((tableName) => tableName.split(".")[0]),
  );
  const currSchemas = new Set(
    Object.keys(curr.tables).map((tableName) => tableName.split(".")[0]),
  );

  // Create new schemas
  for (const currSchema of currSchemas.values()) {
    if (
      !prevSchemas.has(currSchema) &&
      currSchema !== POSTGRES_DEFAULT_SCHEMA
    ) {
      statements.push(`ddl.createSchema("${currSchema}")`);
    }
  }

  // Rename tables
  for (const [oldKey, newKey] of Object.entries(renamedTables)) {
    const oldTable = prev.tables[oldKey];
    const newTable = curr.tables[newKey];
    if (oldTable && newTable) {
      statements.push(
        `ddl.renameTable("${oldTable.schema}", "${oldTable.name}", "${newTable.name}")`,
      );
    }
  }

  // Drop tables (excluding renamed ones)
  for (const tableName of Object.keys(orderTables(prev.tables, "depsLast"))) {
    if (!(tableName in curr.tables) && !renamedFromKeys.has(tableName)) {
      const table = prev.tables[tableName];
      statements.push(`ddl.dropTable("${table.schema}", "${table.name}")`);
    }
  }

  // Drop enums
  for (const enumName in prev.enums) {
    if (!(enumName in curr.enums)) {
      const enm = prev.enums[enumName];
      statements.push(`ddl.dropType("${enm.schema}", "${enm.name}")`);
    }
  }

  // Create/modify enums
  for (const enumName in curr.enums) {
    if (!prev.enums[enumName]) {
      // New enum
      const enm = curr.enums[enumName];
      const values = enm.values.map((v) => `"${v}"`).join(", ");
      statements.push(
        `ddl.createType("${enm.schema}", "${enm.name}", { asEnum: [${values}] })`,
      );
    } else {
      // Check for added values
      const prevValues = prev.enums[enumName].values;
      const currValues = curr.enums[enumName].values;

      if (direction === "up") {
        // Check for removed values (FAIL)
        const removedValues = prevValues.filter((v) => !currValues.includes(v));
        if (removedValues.length > 0) {
          console.error(
            red(
              `Error: Enum "${enumName}" has removed values: ${removedValues.join(", ")}`,
            ),
          );
          console.error(
            yellow("Help: PostgreSQL does not support removing enum values."),
          );
          process.exit(1);
        }

        // Check for reordered values (FAIL)
        const commonValues = prevValues.filter((v) => currValues.includes(v));
        const currCommonIndices = commonValues.map((v) =>
          currValues.indexOf(v),
        );
        for (let i = 1; i < currCommonIndices.length; i++) {
          if (currCommonIndices[i] < currCommonIndices[i - 1]) {
            console.error(
              red(
                `Error: Enum "${enumName}" has reordered values. Original: [${prevValues.join(", ")}], New: [${currValues.join(", ")}]`,
              ),
            );
            process.exit(1);
          }
        }
      }

      const addedValues = currValues.filter((v) => !prevValues.includes(v));
      const removedValuesCount = prevValues.filter(
        (v) => !currValues.includes(v),
      ).length;

      if (addedValues.length > 0 || removedValuesCount > 0) {
        if (direction === "up" && addedValues.length > 0) {
          const enm = curr.enums[enumName];
          for (const addedValue of addedValues) {
            const addedIndex = currValues.indexOf(addedValue);
            let afterValue: string | null = null;
            for (let i = addedIndex - 1; i >= 0; i--) {
              if (prevValues.includes(currValues[i])) {
                afterValue = currValues[i];
                break;
              }
            }
            let beforeValue: string | null = null;
            for (let i = addedIndex + 1; i < currValues.length; i++) {
              if (prevValues.includes(currValues[i])) {
                beforeValue = currValues[i];
                break;
              }
            }

            if (afterValue !== null) {
              statements.push(
                `ddl.alterType("${enm.schema}", "${enm.name}").addValue("${addedValue}", { after: "${afterValue}" })`,
              );
            } else if (beforeValue !== null) {
              statements.push(
                `ddl.alterType("${enm.schema}", "${enm.name}").addValue("${addedValue}", { before: "${beforeValue}" })`,
              );
            } else {
              statements.push(
                `ddl.alterType("${enm.schema}", "${enm.name}").addValue("${addedValue}")`,
              );
            }
          }
        }
      }
    }
  }

  // Drop sequences
  for (const seqName in prev.sequences) {
    if (!(seqName in curr.sequences)) {
      const seq = prev.sequences[seqName];
      statements.push(`ddl.dropSequence("${seq.schema}", "${seq.name}")`);
    }
  }

  // Create sequences
  for (const seqName in curr.sequences) {
    if (!prev.sequences[seqName]) {
      const seq = curr.sequences[seqName];
      const opts: string[] = [];
      if (seq.startWith !== undefined) opts.push(`startWith: ${seq.startWith}`);
      if (seq.increment !== undefined) opts.push(`increment: ${seq.increment}`);
      if (seq.minValue !== undefined) opts.push(`minValue: ${seq.minValue}`);
      if (seq.maxValue !== undefined) opts.push(`maxValue: ${seq.maxValue}`);
      if (seq.cycle) opts.push(`cycle: true`);
      if (seq.cache !== undefined) opts.push(`cache: ${seq.cache}`);

      if (opts.length > 0) {
        statements.push(
          `ddl.createSequence("${seq.schema}", "${seq.name}", { ${opts.join(", ")} })`,
        );
      } else {
        statements.push(`ddl.createSequence("${seq.schema}", "${seq.name}")`);
      }
    }
  }

  // Create/modify tables
  for (const tableName of Object.keys(orderTables(curr.tables, "depsFirst"))) {
    const currTable = curr.tables[tableName];

    // Skip tables that are rename targets (already handled by renameTable)
    if (renamedToKeys.has(tableName)) {
      // Find the prev table key for this renamed table
      const prevKey = Object.entries(renamedTables).find(
        ([, v]) => v === tableName,
      )?.[0];
      if (prevKey) {
        // Still need to handle column changes within the renamed table
        generateAlterTableStmts(
          prev.tables[prevKey],
          currTable,
          tableName,
          curr,
          statements,
          renamedColumns[tableName],
        );
      }
      continue;
    }

    const prevTable = prev.tables[tableName];

    if (!prevTable) {
      // Create new table
      const tableBuilder: string[] = [
        `ddl.createTable("${currTable.schema}", "${currTable.name}")`,
      ];
      for (const [colName, col] of Object.entries(currTable.columns)) {
        tableBuilder.push(
          `.column("${colName}", \`${col.type}\`, ${genDdlColumnOptions(col)})`,
        );
      }
      for (const chk of Object.values(currTable.checkConstraints)) {
        tableBuilder.push(`.check("${chk.name}", \`${chk.sql}\`)`);
      }
      for (const uc of Object.values(currTable.uniqueConstraints ?? {})) {
        const cols = uc.columns.map((c) => `"${c}"`).join(", ");
        tableBuilder.push(`.uniqueConstraint("${uc.name}", [${cols}])`);
      }
      if (currTable.primaryKeyConstraint) {
        const pk = currTable.primaryKeyConstraint;
        const cols = pk.columns.map((c) => `"${c}"`).join(", ");
        tableBuilder.push(`.primaryKeyConstraint("${pk.name}", [${cols}])`);
      }
      statements.push(tableBuilder.join("\n"));

      // Create indexes
      for (const idx of Object.values(currTable.indexes)) {
        const cols = idx.columns
          .map((c) =>
            c.opclass ? `["${c.name}", "${c.opclass}"]` : `"${c.name}"`,
          )
          .join(", ");
        let indexStmt = `ddl.createIndex("${idx.name}").on("${currTable.schema}", "${currTable.name}", [${cols}]).using("${idx.type}")`;
        if (idx.unique) indexStmt += ".unique()";
        if (idx.where) indexStmt += `.where(\`${idx.where}\`)`;
        statements.push(indexStmt);
      }
      continue;
    }

    // Existing table: generate ALTER statements
    generateAlterTableStmts(
      prevTable,
      currTable,
      tableName,
      curr,
      statements,
      renamedColumns[tableName],
    );
  }

  // Drop schemas
  for (const prevSchema of prevSchemas.values()) {
    if (
      !currSchemas.has(prevSchema) &&
      prevSchema !== POSTGRES_DEFAULT_SCHEMA
    ) {
      statements.push(`ddl.dropSchema("${prevSchema}")`);
    }
  }

  if (statements.length === 0) return null;

  // TypeScript migration file content
  return `import { type DDLStatement, ddl, type MigrationOptions } from "durcno/migration";

export const options: MigrationOptions = ${stringifyMigrationOpts(defaultOptions ?? {})};

export const statements: DDLStatement[] = [
  ${statements.join(",\n  ")},
];
`;
}

/** Generates a no-op migration file with an empty statements array. */
function generateNoOpMigration(defaultOptions?: MigrationOptions): string {
  return `import { type DDLStatement, ddl, type MigrationOptions } from "durcno/migration";

export const options: MigrationOptions = ${stringifyMigrationOpts(defaultOptions ?? {})};

export const statements: DDLStatement[] = [];
`;
}

/**
 * Serializes a {@link MigrationOptions} object into a TypeScript object literal
 * string suitable for embedding in a typescript migration file.
 */
function stringifyMigrationOpts(opts: MigrationOptions): string {
  const options = { ...opts };
  if (options.transaction === undefined) options.transaction = true;

  const lines: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) continue;
    lines.push(`  ${key}: ${JSON.stringify(value)},`);
  }

  return `{\n${lines.join("\n")}\n}`;
}

/**
 * Generates ALTER TABLE statements for column changes between prev and curr table snapshots.
 * Handles column renames, drops, additions, and modifications.
 */
function generateAlterTableStmts(
  prevTable: SnapshotTable,
  currTable: SnapshotTable,
  tableName: string,
  curr: Snapshot,
  statements: string[],
  columnRenames?: Record<string, string>,
): void {
  const alterStatements: string[] = [];

  // Build sets for renamed columns
  const renamedFromCols = new Set(
    columnRenames ? Object.keys(columnRenames) : [],
  );
  const renamedToCols = new Set(
    columnRenames ? Object.values(columnRenames) : [],
  );

  // Rename columns
  if (columnRenames) {
    for (const [oldCol, newCol] of Object.entries(columnRenames)) {
      alterStatements.push(`.renameColumn("${oldCol}", "${newCol}")`);
    }
  }

  // Dropped columns (excluding renamed ones)
  for (const colName in prevTable.columns) {
    if (!(colName in currTable.columns) && !renamedFromCols.has(colName)) {
      alterStatements.push(`.dropColumn("${colName}")`);
    }
  }

  // New/modified columns
  for (const colName in currTable.columns) {
    const currCol = currTable.columns[colName];

    // Check if this column was renamed from a prev column
    const renamedFrom = columnRenames
      ? Object.entries(columnRenames).find(([, v]) => v === colName)?.[0]
      : undefined;
    const prevCol = renamedFrom
      ? prevTable.columns[renamedFrom]
      : prevTable.columns[colName];

    if (!prevCol && !renamedToCols.has(colName)) {
      // Truly new column
      alterStatements.push(
        `.addColumn("${colName}", \`${currCol.type}\`, ${genDdlColumnOptions(currCol)})`,
      );
    } else if (prevCol) {
      // Existing or renamed column: check for type/constraint changes
      if (currCol.type !== prevCol.type) {
        alterStatements.push(
          `.alterColumnType("${colName}", \`${currCol.type}\`)`,
        );
      }
      if (currCol.unique !== prevCol.unique) {
        if (currCol.unique) {
          alterStatements.push(`.addUnique("${colName}")`);
        } else {
          const constraintName = `${curr.tables[tableName]?.name ?? currTable.name}_${colName}_key`;
          alterStatements.push(`.dropConstraint("${constraintName}")`);
        }
      }
      if (currCol.notNull !== prevCol.notNull) {
        if (currCol.notNull) {
          alterStatements.push(`.setNotNull("${colName}")`);
        } else {
          alterStatements.push(`.dropNotNull("${colName}")`);
        }
      }
      if (currCol.default !== prevCol.default) {
        if (currCol.default) {
          alterStatements.push(
            `.setDefault("${colName}", "${currCol.default}")`,
          );
        } else {
          alterStatements.push(`.dropDefault("${colName}")`);
        }
      }
      // Handle foreign key reference changes
      const prevRefJson = JSON.stringify(prevCol.references ?? null);
      const currRefJson = JSON.stringify(currCol.references ?? null);
      if (prevRefJson !== currRefJson) {
        if (prevCol.references) {
          const constraintName = `${currTable.name}_${colName}_fkey`;
          alterStatements.push(
            `.dropForeignKey("${constraintName}", "${colName}")`,
          );
        }
        if (currCol.references) {
          const constraintName = `${currTable.name}_${colName}_fkey`;
          alterStatements.push(
            `.addForeignKey("${constraintName}", "${colName}", ${JSON.stringify(currCol.references)})`,
          );
        }
      }
    }
  }

  // Drop removed/changed check constraints
  for (const chkName in prevTable.checkConstraints) {
    const prevChk = prevTable.checkConstraints[chkName];
    const currChk = currTable.checkConstraints[chkName];

    if (!currChk || prevChk.sql !== currChk.sql) {
      alterStatements.push(`.dropConstraint("${chkName}")`);
    }
  }

  // Create new/changed check constraints
  for (const chkName in currTable.checkConstraints) {
    const currChk = currTable.checkConstraints[chkName];
    const prevChk = prevTable.checkConstraints[chkName];

    if (!prevChk || prevChk.sql !== currChk.sql) {
      alterStatements.push(`.addCheck("${chkName}", \`${currChk.sql}\`)`);
    }
  }

  // Drop removed/changed unique constraints
  const prevUniqueConstraints = prevTable.uniqueConstraints ?? {};
  const currUniqueConstraints = currTable.uniqueConstraints ?? {};

  for (const ucName in prevUniqueConstraints) {
    const prevUc = prevUniqueConstraints[ucName];
    const currUc = currUniqueConstraints[ucName];

    if (!currUc) {
      alterStatements.push(`.dropConstraint("${ucName}")`);
    } else {
      const prevCols = prevUc.columns.join(",");
      const currCols = currUc.columns.join(",");
      if (prevCols !== currCols) {
        alterStatements.push(`.dropConstraint("${ucName}")`);
      }
    }
  }

  // Create new/changed unique constraints
  for (const ucName in currUniqueConstraints) {
    const currUc = currUniqueConstraints[ucName];
    const prevUc = prevUniqueConstraints[ucName];

    if (!prevUc) {
      const cols = currUc.columns.map((c) => `"${c}"`).join(", ");
      alterStatements.push(`.addUniqueConstraint("${ucName}", [${cols}])`);
    } else {
      const prevCols = prevUc.columns.join(",");
      const currCols = currUc.columns.join(",");
      if (prevCols !== currCols) {
        const cols = currUc.columns.map((c) => `"${c}"`).join(", ");
        alterStatements.push(`.addUniqueConstraint("${ucName}", [${cols}])`);
      }
    }
  }

  // Handle primary key constraint changes
  const prevPk = prevTable.primaryKeyConstraint;
  const currPk = currTable.primaryKeyConstraint;

  if (prevPk && !currPk) {
    alterStatements.push(`.dropConstraint("${prevPk.name}")`);
  } else if (!prevPk && currPk) {
    const cols = currPk.columns.map((c) => `"${c}"`).join(", ");
    alterStatements.push(
      `.addPrimaryKeyConstraint("${currPk.name}", [${cols}])`,
    );
  } else if (prevPk && currPk) {
    const prevCols = prevPk.columns.join(",");
    const currCols = currPk.columns.join(",");
    if (prevPk.name !== currPk.name || prevCols !== currCols) {
      alterStatements.push(`.dropConstraint("${prevPk.name}")`);
      const cols = currPk.columns.map((c) => `"${c}"`).join(", ");
      alterStatements.push(
        `.addPrimaryKeyConstraint("${currPk.name}", [${cols}])`,
      );
    }
  }

  // Drop removed or changed indexes (must happen before columns are dropped)
  for (const idxName in prevTable.indexes) {
    const prevIdx = prevTable.indexes[idxName];
    const currIdx = currTable.indexes[idxName];
    if (!currIdx || !indexesEqual(prevIdx, currIdx)) {
      statements.push(`ddl.dropIndex("${idxName}")`);
    }
  }

  if (alterStatements.length > 0) {
    statements.push(
      `ddl.alterTable("${currTable.schema}", "${currTable.name}")\n${alterStatements.join("\n")}`,
    );
  }

  // Create new or changed indexes (must happen after columns are added)
  for (const idxName in currTable.indexes) {
    const prevIdx = prevTable.indexes[idxName];
    const currIdx = currTable.indexes[idxName];
    if (!prevIdx || !indexesEqual(prevIdx, currIdx)) {
      const idx = currIdx;
      const cols = idx.columns
        .map((c) =>
          c.opclass ? `["${c.name}", "${c.opclass}"]` : `"${c.name}"`,
        )
        .join(", ");
      let indexStmt = `ddl.createIndex("${idx.name}").on("${currTable.schema}", "${currTable.name}", [${cols}]).using("${idx.type}")`;
      if (idx.unique) indexStmt += ".unique()";
      if (idx.where) indexStmt += `.where(\`${idx.where}\`)`;
      statements.push(indexStmt);
    }
  }
}

function indexesEqual(a: SnapshotTableIndex, b: SnapshotTableIndex): boolean {
  if (a.type !== b.type) return false;
  if (a.unique !== b.unique) return false;
  if ((a.where ?? undefined) !== (b.where ?? undefined)) return false;
  if (a.columns.length !== b.columns.length) return false;
  for (let i = 0; i < a.columns.length; i++) {
    if (a.columns[i].name !== b.columns[i].name) return false;
    if (a.columns[i].opclass !== b.columns[i].opclass) return false;
  }
  return true;
}

function genDdlColumnOptions(col: SnapshotColumn) {
  const opts: string[] = [];
  if (col.primaryKey) opts.push("primaryKey: true");
  if (col.notNull) opts.push("notNull: true");
  if (col.unique) opts.push("unique: true");
  if (col.default !== undefined) opts.push(`default: \`${col.default}\``);
  if (col.generated) opts.push(`generated: "${col.generated}"`);
  if (col.as) opts.push(`as: \`${col.as}\``);
  if (col.references) {
    opts.push(`references: ${JSON.stringify(col.references)}`);
  }
  return `{ ${opts.join(", ")} }`;
}

function orderTables(
  tables: Record<string, SnapshotTable>,
  order: "depsFirst" | "depsLast",
) {
  const tablesSorted = Object.keys(tables).sort();

  const tablesDependencies: Record<string, string[]> = Object.fromEntries(
    Object.entries(tables).map(([tableName, table]) => {
      const references = Object.values(table.columns)
        .map((column) =>
          column.references
            ? `${column.references.schema}.${column.references.table}`
            : undefined,
        )
        .filter(
          (table) => table !== undefined && table !== tableName,
        ) as string[];
      return [tableName, references];
    }),
  );

  let tablesOrdered = getOrderedDependencies(tablesSorted, tablesDependencies);
  if (order === "depsLast") {
    tablesOrdered = tablesOrdered.reverse();
  }

  return Object.fromEntries(
    tablesOrdered.map((tableName) => [tableName, tables[tableName]]),
  );
}
