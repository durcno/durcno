import chalk from "chalk";
import type { OnDeleteAction } from "../columns/common";
import { check, createCheckTableProxy } from "../constraints/check";
import { primaryKeyConstraint } from "../constraints/primary-key";
import { uniqueConstraint } from "../constraints/unique";
import { is } from "../entity";
import { Enum } from "../enumtype";
import type { IndexType } from "../indexes";
import { Sequence } from "../sequence";
import { type StdTableWithColumns, Table } from "../table";

const { red } = chalk;

/**
 * Full database snapshot containing all tracked schema objects.
 *
 * A snapshot is a point-in-time representation of the database schema
 * used by the migration system to compute diffs and generate DDL.
 */
export interface Snapshot {
  /** All tracked tables, keyed by `"schema.name"`. */
  tables: Record<string, SnapshotTable>;
  /** All tracked enum types, keyed by `"schema.name"`. */
  enums: Record<string, SnapshotEnum>;
  /** All tracked sequences, keyed by `"schema.name"`. */
  sequences: Record<string, SnapshotSequence>;
}

/**
 * Snapshot of a single table including columns, indexes, and constraints.
 */
export interface SnapshotTable {
  /** The PostgreSQL schema this table belongs to (e.g. `"public"`). */
  schema: string;
  /** The table name. */
  name: string;
  /** Columns in the table, keyed by column name. */
  columns: Record<string, SnapshotColumn>;
  /** Indexes on the table, keyed by index name. */
  indexes: Record<string, SnapshotTableIndex>;
  /** CHECK constraints, keyed by constraint name. */
  checkConstraints: Record<string, SnapshotTableCheck>;
  /** UNIQUE constraints (table-level), keyed by constraint name. */
  uniqueConstraints: Record<string, SnapshotTableUnique>;
  /** Composite PRIMARY KEY constraint, if defined. */
  primaryKeyConstraint?: SnapshotTablePrimaryKey;
}

/**
 * A foreign-key column reference used in {@link SnapshotColumn["references"]}.
 */
export interface SnapshotColumnRef {
  /** Schema of the referenced table. */
  schema: string;
  /** Name of the referenced table. */
  table: string;
  /** Name of the referenced column. */
  column: string;
  /** The `ON DELETE` action for this foreign key. */
  onDelete: OnDeleteAction;
}

/**
 * Snapshot of a single column's metadata.
 */
export interface SnapshotColumn {
  /** The SQL type of the column (e.g. `"varchar(255)"`, `"integer"`). */
  type: string;
  /** Whether the column has a `NOT NULL` constraint. */
  notNull?: true;
  /** Whether the column is the table's primary key. */
  primaryKey?: true;
  /** Whether the column has a `UNIQUE` constraint. */
  unique?: true;
  /** The column's `DEFAULT` expression, as a raw SQL string. */
  default?: string;
  /** The `GENERATED` clause (e.g. `"ALWAYS"` or `"BY DEFAULT"`). */
  generated?: string;
  /** The `AS` expression for generated columns. */
  as?: string;
  /** Foreign key reference, if this column references another table. */
  references?: SnapshotColumnRef;
}

/**
 * Snapshot of a PostgreSQL `ENUM` type.
 */
export interface SnapshotEnum {
  /** The schema the enum belongs to. */
  schema: string;
  /** The enum type name. */
  name: string;
  /** Ordered list of allowed values. */
  values: string[];
}

/**
 * Snapshot of a PostgreSQL `SEQUENCE`.
 */
export interface SnapshotSequence {
  /** The schema the sequence belongs to. */
  schema: string;
  /** The sequence name. */
  name: string;
  /** `START WITH` value. */
  startWith?: number;
  /** `INCREMENT BY` value. */
  increment?: number;
  /** `MINVALUE` value. */
  minValue?: number;
  /** `MAXVALUE` value. */
  maxValue?: number;
  /** Whether the sequence wraps around (`CYCLE`). */
  cycle?: boolean;
  /** Number of sequence values to pre-allocate (`CACHE`). */
  cache?: number;
}

/**
 * Snapshot of a table index.
 */
export interface SnapshotTableIndex {
  /** The index name. */
  name: string;
  /** The `"schema.table"` key of the owning table. */
  table: string;
  /** Column names included in the index. */
  columns: string[];
  /** The index method (e.g. `"btree"`, `"hash"`, `"gin"`, `"gist"`). */
  type: IndexType;
  /** Whether this is a unique index. */
  unique: boolean;
}

/**
 * Snapshot of a CHECK constraint.
 */
export interface SnapshotTableCheck {
  /** The constraint name. */
  name: string;
  /** The check constraint SQL expression. */
  sql: string;
}

/**
 * Snapshot of a table-level UNIQUE constraint.
 */
export interface SnapshotTableUnique {
  /** The constraint name. */
  name: string;
  /** The `"schema.table"` key of the owning table. */
  table: string;
  /** Column names that form the unique key. */
  columns: string[];
}

/**
 * Snapshot of a table-level PRIMARY KEY constraint.
 */
export interface SnapshotTablePrimaryKey {
  /** The constraint name. */
  name: string;
  /** The `"schema.table"` key of the owning table. */
  table: string;
  /** Column names that form the primary key. */
  columns: string[];
}

/**
 * Creates an empty {@link Snapshot} with no tables, enums, or sequences.
 *
 * @returns A new empty snapshot object.
 */
export function createEmptySnapshot(): Snapshot {
  return {
    enums: {},
    tables: {},
    sequences: {},
  };
}

/**
 * Generates a {@link Snapshot} from an array of Durcno entities (tables, enums, sequences).
 *
 * This function introspects the provided entities to extract their schema metadata
 * and constructs a snapshot object that represents the current state of the database schema.
 * @param entities - An array of Durcno entities (tables, enums, sequences) to include in the snapshot.
 * @returns A {@link Snapshot} object representing the current state of the database schema.
 */
export function snapshot(entities: unknown[]): Snapshot {
  const ss: Snapshot = {
    enums: {},
    tables: {},
    sequences: {},
  };
  for (const entity of entities) {
    if (is(entity, Enum)) {
      const enm = entity;
      ss.enums[`${enm.schema}.${enm.name}`] = {
        schema: enm.schema,
        name: enm.name,
        values: [...enm.values],
      };
    } else if (is(entity, Table)) {
      const table = entity;
      ss.tables[`${table._.schema}.${table._.name}`] = {
        schema: table._.schema,
        name: table._.name,
        columns: {},
        indexes: {},
        checkConstraints: {},
        uniqueConstraints: {},
      };
      Object.entries(table._.columns).forEach(([_, col]) => {
        const {
          getReferencesCol: referencesCol,
          getReferencesOnDelete: referencesOnDelete,
        } = col;
        ss.tables[`${table._.schema}.${table._.name}`].columns[col.nameSnake] =
          {
            type: col.sqlType,
            default: col.getDefaultSqlStr,
            primaryKey: col.isPrimaryKey || undefined,
            references:
              referencesCol !== null
                ? {
                    schema: referencesCol.table._.schema,
                    table: referencesCol.table._.name,
                    column: referencesCol.nameSnake,
                    onDelete: referencesOnDelete ?? "CASCADE",
                  }
                : undefined,
            unique: col.isUnique || undefined,
            notNull: col.isNotNull || undefined,
            generated: col.getGenerated,
            as: col.getGeneratedAs,
          };
      });
      (table._.extra.indexes?.(table as StdTableWithColumns) ?? []).forEach(
        (index) => {
          ss.tables[`${table._.schema}.${table._.name}`].indexes[
            index._.getName(table)
          ] = {
            name: index._.getName(table),
            table: table._.fullName,
            columns: index._.getColumns().map((col) => col.nameSnake),
            type: index._.getUsing(),
            unique: index._.getUnique(),
          };
        },
      );
      const checkProxyTable = createCheckTableProxy(table);
      (table._.extra.checkConstraints?.(checkProxyTable, check) ?? []).forEach(
        (chk) => {
          ss.tables[`${table._.schema}.${table._.name}`].checkConstraints[
            chk.getName()
          ] = {
            name: chk.getName(),
            sql: chk.toSQL(),
          };
        },
      );
      (
        table._.extra.uniqueConstraints?.(
          table as StdTableWithColumns,
          uniqueConstraint,
        ) ?? []
      ).forEach((uc) => {
        ss.tables[`${table._.schema}.${table._.name}`].uniqueConstraints[
          uc.getName(table)
        ] = {
          name: uc.getName(table),
          table: table._.fullName,
          columns: uc.getColumns(),
        };
      });
      const pkConstraint = table._.extra.primaryKeyConstraint?.(
        table as StdTableWithColumns,
        primaryKeyConstraint,
      );
      if (pkConstraint) {
        // Validate: no column-level primaryKey should coexist with table-level primaryKeyConstraint
        const hasColumnLevelPK = Object.values(
          ss.tables[`${table._.schema}.${table._.name}`].columns,
        ).some((col) => col.primaryKey);
        if (hasColumnLevelPK) {
          console.error(
            red(
              `[Error] Table "${table._.schema}"."${table._.name}" has both a column-level primaryKey and a table-level primaryKeyConstraint. Remove one of them.`,
            ),
          );
          process.exit(1);
        }
        ss.tables[`${table._.schema}.${table._.name}`].primaryKeyConstraint = {
          name: pkConstraint.getName(table),
          table: table._.fullName,
          columns: pkConstraint.getColumns(),
        };
      }
    } else if (is(entity, Sequence)) {
      const seq = entity;
      ss.sequences[`${seq.schema}.${seq.name}`] = {
        schema: seq.schema,
        name: seq.name,
        startWith: seq.config.startWith,
        increment: seq.config.increment,
        minValue: seq.config.minValue,
        maxValue: seq.config.maxValue,
        cycle: seq.config.cycle,
        cache: seq.config.cache,
      };
    }
  }
  return ss;
}
