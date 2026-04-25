import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";
import { buildRelation } from "./utils";

/**
 * DDL statement that creates a new PostgreSQL enum type.
 *
 * Generates: `CREATE TYPE "schema"."name" AS ENUM('val1', 'val2', ...);`
 *
 * @deprecated Use {@link CreateTypeStatement} via `ddl.createType()` instead.
 *
 * @example
 * ```typescript
 * ddl.createEnum('public', 'user_type', ['admin', 'user', 'guest']);
 * // CREATE TYPE "public"."user_type" AS ENUM('admin', 'user', 'guest');
 * ```
 */
export class CreateEnumStatement extends DDLStatement {
  readonly type = "createEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The name of the enum type to create.
   * @param values - Ordered list of allowed enum values.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly values: string[],
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    const valuesStr = this.values.map((v) => `'${v}'`).join(", ");
    return `CREATE TYPE ${relation} AS ENUM(${valuesStr});`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    snapshot.enums[key] = {
      schema: this.schema,
      name: this.name,
      values: [...this.values],
    };
  }
}

/**
 * DDL statement that adds a value to an existing PostgreSQL enum type.
 *
 * Generates: `ALTER TYPE "schema"."name" ADD VALUE IF NOT EXISTS 'value' [AFTER|BEFORE 'ref'];`
 *
 * @remarks
 * PostgreSQL does not support removing values from an enum.
 * Values can only be added, optionally positioned relative to an existing value.
 *
 * @deprecated Use {@link AlterTypeBuilder} via `ddl.alterType()` instead.
 *
 * @example
 * ```typescript
 * // Append a value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator');
 *
 * // Insert after a specific value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator', { after: 'admin' });
 *
 * // Insert before a specific value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator', { before: 'user' });
 * ```
 */
export class AlterEnumAddValueStatement extends DDLStatement {
  readonly type = "alterEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @param value - The new value to add.
   * @param position - Optional positioning: `{ after: 'val' }` or `{ before: 'val' }`.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly value: string,
    private readonly position?: { after?: string; before?: string },
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    let sql = `ALTER TYPE ${relation} ADD VALUE IF NOT EXISTS '${this.value}'`;
    if (this.position?.after) {
      sql += ` AFTER '${this.position.after}'`;
    } else if (this.position?.before) {
      sql += ` BEFORE '${this.position.before}'`;
    }
    return `${sql};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    const enm = snapshot.enums[key];
    if (!enm) return;

    // Find insertion position
    if (this.position?.after) {
      const afterIdx = enm.values.indexOf(this.position.after);
      if (afterIdx !== -1) {
        enm.values.splice(afterIdx + 1, 0, this.value);
        return;
      }
    } else if (this.position?.before) {
      const beforeIdx = enm.values.indexOf(this.position.before);
      if (beforeIdx !== -1) {
        enm.values.splice(beforeIdx, 0, this.value);
        return;
      }
    }
    // Default: append to end
    enm.values.push(this.value);
  }
}

/**
 * DDL statement that drops an existing PostgreSQL enum type.
 *
 * Generates: `DROP TYPE "schema"."name";`
 *
 * @deprecated Use {@link DropTypeStatement} via `ddl.dropType()` instead.
 *
 * @example
 * ```typescript
 * ddl.dropEnum('public', 'user_type');
 * // DROP TYPE "public"."user_type";
 * ```
 */
export class DropEnumStatement extends DDLStatement {
  readonly type = "dropEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name to drop.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    return `DROP TYPE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.enums[key];
  }
}
