import type { SnakeCase } from "../../types";
import { camelToSnake } from "../../utils";
import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./index";

/**
 * Create a new PostgreSQL type.
 *
 * Currently supports enum types only.
 *
 * @param schema - The schema the type belongs to.
 * @param name - The type name.
 * @param definition - The type definition. Currently only `{ asEnum: string[] }` is supported.
 * @returns A {@link CreateTypeStatement}.
 *
 * @example
 * ```typescript
 * ddl.createType('public', 'user_type', { asEnum: ['admin', 'user'] });
 * ```
 */
export function createType(
  schema: string,
  name: string,
  definition: { asEnum: string[] },
): CreateTypeStatement {
  return new CreateTypeStatement(schema, name, definition);
}

/**
 * DDL statement that creates a new PostgreSQL type.
 *
 * Currently supports enum types only.
 *
 * Generates: `CREATE TYPE "schema"."name" AS ENUM('val1', 'val2', ...);`
 *
 * @example
 * ```typescript
 * ddl.createType('public', 'user_type', { asEnum: ['admin', 'user', 'guest'] });
 * // CREATE TYPE "public"."user_type" AS ENUM('admin', 'user', 'guest');
 * ```
 */
export class CreateTypeStatement extends DDLStatement {
  readonly type = "createType" as const;
  private readonly schema: SnakeCase;
  private readonly name: SnakeCase;
  private readonly definition: { asEnum: string[] };

  /**
   * @param schema - The schema the type belongs to.
   * @param name - The type name to create.
   * @param definition - The type definition. Currently only `{ asEnum: string[] }` is supported.
   */
  constructor(schema: string, name: string, definition: { asEnum: string[] }) {
    super();
    this.schema = camelToSnake(schema);
    this.name = camelToSnake(name);
    this.definition = definition;
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;
    const valuesStr = this.definition.asEnum.map((v) => `'${v}'`).join(", ");
    return `CREATE TYPE ${relation} AS ENUM(${valuesStr});`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    snapshot.enums[key] = {
      schema: this.schema,
      name: this.name,
      values: [...this.definition.asEnum],
    };
  }
}

/**
 * Drop an existing PostgreSQL type.
 *
 * @param schema - The schema the type belongs to.
 * @param name - The type name.
 * @returns A {@link DropTypeStatement}.
 *
 * @example
 * ```typescript
 * ddl.dropType('public', 'user_type');
 * ```
 */
export function dropType(schema: string, name: string): DropTypeStatement {
  return new DropTypeStatement(schema, name);
}

/**
 * DDL statement that drops an existing PostgreSQL type.
 *
 * Generates: `DROP TYPE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropType('public', 'user_type');
 * // DROP TYPE "public"."user_type";
 * ```
 */
export class DropTypeStatement extends DDLStatement {
  readonly type = "dropType" as const;
  private readonly schema: SnakeCase;
  private readonly name: SnakeCase;

  /**
   * @param schema - The schema the type belongs to.
   * @param name - The type name to drop.
   */
  constructor(schema: string, name: string) {
    super();
    this.schema = camelToSnake(schema);
    this.name = camelToSnake(name);
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;
    return `DROP TYPE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.enums[key];
  }
}

/** Describes a single action queued on an {@link AlterTypeBuilder}. */
type AlterTypeAction =
  | {
      kind: "addValue";
      value: string;
      position?: { after?: string; before?: string };
    }
  | {
      kind: "renameValue";
      from: string;
      to: string;
    };

/**
 * Alter an existing type. Returns a chainable {@link AlterTypeBuilder}.
 *
 * Currently supports enum value operations only.
 *
 * @param schema - The schema the type belongs to.
 * @param name - The type name.
 * @returns An {@link AlterTypeBuilder} for chaining `.addValue()`.
 *
 * @example
 * ```typescript
 * ddl.alterType('public', 'user_type')
 *   .addValue('moderator', { after: 'admin' })
 *   .addValue('guest');
 * ```
 */
export function alterType(schema: string, name: string): AlterTypeBuilder {
  return new AlterTypeBuilder(schema, name);
}

/**
 * Fluent builder for `ALTER TYPE` DDL statements.
 *
 * Currently supports enum value operations only.
 * Each chained method appends one action; {@link toSQL} emits one SQL
 * statement per action.
 *
 * @example
 * ```typescript
 * ddl.alterType('public', 'user_type')
 *   .addValue('moderator', { after: 'admin' })
 *   .addValue('guest');
 * // ALTER TYPE "public"."user_type" ADD VALUE IF NOT EXISTS 'moderator' AFTER 'admin';
 * // ALTER TYPE "public"."user_type" ADD VALUE IF NOT EXISTS 'guest';
 *
 * ddl.alterType('public', 'user_type')
 *   .renameValue('guest', 'visitor');
 * // ALTER TYPE "public"."user_type" RENAME VALUE 'guest' TO 'visitor';
 * ```
 */
export class AlterTypeBuilder extends DDLStatement {
  readonly type = "alterType" as const;
  private readonly schema: SnakeCase;
  private readonly name: SnakeCase;
  private readonly actions: AlterTypeAction[] = [];

  /**
   * @param schema - The schema the type belongs to.
   * @param name - The type name.
   */
  constructor(schema: string, name: string) {
    super();
    this.schema = camelToSnake(schema);
    this.name = camelToSnake(name);
  }

  /**
   * Add a value to an existing enum type.
   *
   * Generates: `ALTER TYPE "schema"."name" ADD VALUE IF NOT EXISTS 'value' [AFTER|BEFORE 'ref'];`
   *
   * @remarks
   * PostgreSQL does not support removing enum values.
   *
   * @param value - The new enum value to add.
   * @param position - Optional positioning: `{ after: 'val' }` or `{ before: 'val' }`.
   * @returns `this` for chaining.
   */
  addValue(
    value: string,
    position?: { after?: string; before?: string },
  ): this {
    this.actions.push({ kind: "addValue", value, position });
    return this;
  }

  /**
   * Rename an existing enum value.
   *
   * Generates: `ALTER TYPE "schema"."name" RENAME VALUE 'from' TO 'to';`
   *
   * @param from - The existing enum value to rename.
   * @param to - The new name for the enum value.
   * @returns `this` for chaining.
   */
  renameValue(from: string, to: string): this {
    this.actions.push({ kind: "renameValue", from, to });
    return this;
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;
    const statements: string[] = [];

    for (const action of this.actions) {
      switch (action.kind) {
        case "renameValue":
          statements.push(
            `ALTER TYPE ${relation} RENAME VALUE '${action.from}' TO '${action.to}';`,
          );
          break;
        case "addValue": {
          let sql = `ALTER TYPE ${relation} ADD VALUE IF NOT EXISTS '${action.value}'`;
          if (action.position?.after) {
            sql += ` AFTER '${action.position.after}'`;
          } else if (action.position?.before) {
            sql += ` BEFORE '${action.position.before}'`;
          }
          statements.push(`${sql};`);
          break;
        }
      }
    }

    return statements.join("\n");
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    const enm = snapshot.enums[key];
    if (!enm) return;

    for (const action of this.actions) {
      switch (action.kind) {
        case "renameValue": {
          const idx = enm.values.indexOf(action.from);
          if (idx !== -1) {
            enm.values[idx] = action.to;
          }
          break;
        }
        case "addValue": {
          if (action.position?.after) {
            const afterIdx = enm.values.indexOf(action.position.after);
            if (afterIdx !== -1) {
              enm.values.splice(afterIdx + 1, 0, action.value);
              break;
            }
          } else if (action.position?.before) {
            const beforeIdx = enm.values.indexOf(action.position.before);
            if (beforeIdx !== -1) {
              enm.values.splice(beforeIdx, 0, action.value);
              break;
            }
          }
          enm.values.push(action.value);
          break;
        }
      }
    }
  }
}
