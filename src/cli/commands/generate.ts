import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import chalk from "chalk";
import {
  createEmptySnapshot,
  type DDLStatement,
  snapshot,
} from "durcno/migration";
import prompts from "prompts";
import { snapshotExprToSQL } from "../../constraints/check";
import type {
  Snapshot,
  SnapshotColumn,
  SnapshotTable,
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

function onCancel() {
  console.log(`${yellow("[QUIT]")} ${gray("Generation cancelled.")}`);
  process.exit(0);
}

/**
 * Detects tables that were potentially renamed by comparing dropped and added tables.
 * Prompts the user to confirm each rename.
 */
async function promptTableRenames(
  prev: Snapshot,
  curr: Snapshot,
): Promise<RenamedTables> {
  const renames: RenamedTables = {};

  const droppedTables: string[] = [];
  for (const tableName of Object.keys(prev.tables)) {
    if (!(tableName in curr.tables)) {
      droppedTables.push(tableName);
    }
  }

  const addedTables: string[] = [];
  for (const tableName of Object.keys(curr.tables)) {
    if (!(tableName in prev.tables)) {
      addedTables.push(tableName);
    }
  }

  if (droppedTables.length === 0 || addedTables.length === 0) {
    return renames;
  }

  const claimedAdded = new Set<string>();

  for (const droppedKey of droppedTables) {
    const droppedTable = prev.tables[droppedKey];
    const sameSchemaAdded = addedTables.filter(
      (k) =>
        curr.tables[k].schema === droppedTable.schema && !claimedAdded.has(k),
    );

    if (sameSchemaAdded.length === 0) continue;

    const { choice } = await prompts(
      {
        type: "select",
        name: "choice",
        message: `Is the table "${droppedTable.schema}"."${droppedTable.name}" renamed to?`,
        choices: [
          ...sameSchemaAdded.map((k) => ({
            title: curr.tables[k].name,
            value: k,
          })),
          { title: "No, it was deleted", value: "" },
        ],
      },
      { onCancel },
    );

    if (choice) {
      renames[droppedKey] = choice;
      claimedAdded.add(choice);
    }
  }

  return renames;
}

/**
 * Detects columns that were potentially renamed by comparing dropped and added columns
 * within tables that exist in both snapshots (accounting for table renames).
 * Prompts the user to confirm each rename.
 */
async function promptColumnRenames(
  prev: Snapshot,
  curr: Snapshot,
  renamedTables: RenamedTables,
): Promise<RenamedColumns> {
  const renames: RenamedColumns = {};

  // Build a mapping from prev table key to curr table key
  const tablePairs: { prevKey: string; currKey: string }[] = [];

  for (const prevKey of Object.keys(prev.tables)) {
    if (prevKey in renamedTables) {
      // Table was renamed
      tablePairs.push({ prevKey, currKey: renamedTables[prevKey] });
    } else if (prevKey in curr.tables) {
      // Table still exists with the same name
      tablePairs.push({ prevKey, currKey: prevKey });
    }
  }

  for (const { prevKey, currKey } of tablePairs) {
    const prevTable = prev.tables[prevKey];
    const currTable = curr.tables[currKey];

    const droppedCols: string[] = [];
    for (const colName of Object.keys(prevTable.columns)) {
      if (!(colName in currTable.columns)) {
        droppedCols.push(colName);
      }
    }

    const addedCols: string[] = [];
    for (const colName of Object.keys(currTable.columns)) {
      if (!(colName in prevTable.columns)) {
        addedCols.push(colName);
      }
    }

    if (droppedCols.length === 0 || addedCols.length === 0) continue;

    const claimedAdded = new Set<string>();

    for (const droppedCol of droppedCols) {
      const availableAdded = addedCols.filter((c) => !claimedAdded.has(c));
      if (availableAdded.length === 0) break;

      const tableName = `"${currTable.schema}"."${currTable.name}"`;
      const { choice } = await prompts(
        {
          type: "select",
          name: "choice",
          message: `Is the column "${droppedCol}" in ${tableName} renamed to?`,
          choices: [
            ...availableAdded.map((c) => ({ title: c, value: c })),
            { title: "No, it was deleted", value: "" },
          ],
        },
        { onCancel },
      );

      if (choice) {
        if (!renames[currKey]) renames[currKey] = {};
        renames[currKey][droppedCol] = choice;
        claimedAdded.add(choice);
      }
    }
  }

  return renames;
}

export async function generate(options: Options) {
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

  // Prompt for potential table and column renames
  const renamedTables = await promptTableRenames(ssPrevious, ssCurrent);
  const renamedColumns = await promptColumnRenames(
    ssPrevious,
    ssCurrent,
    renamedTables,
  );

  const migrationUpTs = generateMigration(
    ssPrevious,
    ssCurrent,
    "up",
    renamedTables,
    renamedColumns,
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
    migrationDnTs ?? generateNoOpMigration(),
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
        tableBuilder.push(`.check("${chk.name}", ${JSON.stringify(chk.expr)})`);
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
        const cols = idx.columns.map((c) => `"${c}"`).join(", ");
        let indexStmt = `ddl.createIndex("${idx.name}").on("${currTable.schema}", "${currTable.name}", [${cols}]).using("${idx.type}")`;
        if (idx.unique) indexStmt += ".unique()";
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

export const options: MigrationOptions = {
  transaction: true,
};

export const statements: DDLStatement[] = [
  ${statements.join(",\n  ")},
];
`;
}

/** Generates a no-op migration file with an empty statements array. */
function generateNoOpMigration(): string {
  return `import { type DDLStatement, ddl, type MigrationOptions } from "durcno/migration";

export const options: MigrationOptions = {
  transaction: true,
};

export const statements: DDLStatement[] = [];
`;
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
        `.addColumn("${colName}", "${currCol.type}", ${genDdlColumnOptions(currCol)})`,
      );
    } else if (prevCol) {
      // Existing or renamed column: check for type/constraint changes
      if (currCol.type !== prevCol.type) {
        alterStatements.push(
          `.alterColumnType("${colName}", "${currCol.type}")`,
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

  // New indexes
  for (const idxName in currTable.indexes) {
    if (!prevTable.indexes[idxName]) {
      const idx = currTable.indexes[idxName];
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      let indexStmt = `ddl.createIndex("${idx.name}").on("${currTable.schema}", "${currTable.name}", [${cols}]).using("${idx.type}")`;
      if (idx.unique) indexStmt += ".unique()";
      statements.push(indexStmt);
    }
  }

  // Drop removed/changed check constraints
  for (const chkName in prevTable.checkConstraints) {
    const prevChk = prevTable.checkConstraints[chkName];
    const currChk = currTable.checkConstraints[chkName];

    if (!currChk) {
      alterStatements.push(`.dropConstraint("${chkName}")`);
    } else {
      const prevSql = snapshotExprToSQL(prevChk.expr);
      const currSql = snapshotExprToSQL(currChk.expr);
      if (prevSql !== currSql) {
        alterStatements.push(`.dropConstraint("${chkName}")`);
      }
    }
  }

  // Create new/changed check constraints
  for (const chkName in currTable.checkConstraints) {
    const currChk = currTable.checkConstraints[chkName];
    const prevChk = prevTable.checkConstraints[chkName];

    if (!prevChk) {
      alterStatements.push(
        `.addCheck("${chkName}", ${JSON.stringify(currChk.expr)})`,
      );
    } else {
      const prevSql = snapshotExprToSQL(prevChk.expr);
      const currSql = snapshotExprToSQL(currChk.expr);
      if (prevSql !== currSql) {
        alterStatements.push(
          `.addCheck("${chkName}", ${JSON.stringify(currChk.expr)})`,
        );
      }
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

  if (alterStatements.length > 0) {
    statements.push(
      `ddl.alterTable("${currTable.schema}", "${currTable.name}")\n${alterStatements.join("\n")}`,
    );
  }
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
        .filter((table) => table !== undefined) as string[];
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
