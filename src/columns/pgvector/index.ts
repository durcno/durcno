import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig, type Tuple } from "../common";

// ============================================================================
// Vector Column
// ============================================================================

export type VectorConfig = ColumnConfig & {
  dimensions?: number;
};

/** Derives a fixed-length numeric tuple when `dimensions` is a number literal, otherwise `number[]`. */
type VectorValue<TConfig extends VectorConfig> = TConfig extends {
  dimensions: infer D extends number;
}
  ? number extends D
    ? number[]
    : Tuple<number, D>
  : number[];

export class VectorColumn<TConfig extends VectorConfig> extends Column<
  TConfig,
  VectorValue<TConfig>,
  "numeric"
> {
  static readonly id = "Column.Vector";
  readonly #dimensions: TConfig["dimensions"];

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `vector(${this.#dimensions})` : "vector";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler(): TConfig["dimensions"] extends number
    ? z.ZodTuple<Tuple<z.ZodNumber, TConfig["dimensions"]>, null>
    : z.ZodArray<z.ZodNumber> {
    if (this.#dimensions === undefined) return z.array(z.number()) as any;
    return z.tuple(
      Array.from({ length: this.#dimensions }, () => z.number()) as unknown as [
        z.ZodAny,
      ],
    ) as any;
  }

  toDriverScalar(value: VectorValue<TConfig> | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql
      ? value.string
      : `[${(value as number[]).join(",")}]`;
  }

  toSQLScalar(value: VectorValue<TConfig> | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'[${(value as number[]).join(",")}]'`;
  }

  fromDriverScalar(value: unknown): VectorValue<TConfig> | null {
    if (value === null) return null;
    if (Array.isArray(value)) return value as VectorValue<TConfig>;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as VectorValue<TConfig>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Creates a `vector` column. PostgreSQL pgvector dense vector type, maps to `number[]`.
 *
 * @example
 * ```ts
 * vector({ dimensions: 1536, notNull }) // vector(1536) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function vector<const TConfig extends VectorConfig>(
  config: TConfig = {} as TConfig,
) {
  return new VectorColumn(config);
}

// ============================================================================
// Halfvec Column
// ============================================================================

export type HalfvecConfig = ColumnConfig & {
  dimensions?: number;
};

/** Derives a fixed-length numeric tuple when `dimensions` is a number literal, otherwise `number[]`. */
type HalfvecValue<TConfig extends HalfvecConfig> = TConfig extends {
  dimensions: infer D extends number;
}
  ? number extends D
    ? number[]
    : Tuple<number, D>
  : number[];

export class HalfvecColumn<TConfig extends HalfvecConfig> extends Column<
  TConfig,
  HalfvecValue<TConfig>,
  "numeric"
> {
  static readonly id = "Column.Halfvec";
  readonly #dimensions: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `halfvec(${this.#dimensions})` : "halfvec";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler(): TConfig["dimensions"] extends number
    ? z.ZodTuple<Tuple<z.ZodNumber, TConfig["dimensions"]>, null>
    : z.ZodArray<z.ZodNumber> {
    if (this.#dimensions === undefined) return z.array(z.number()) as any;
    return z.tuple(
      Array.from({ length: this.#dimensions }, () => z.number()) as unknown as [
        z.ZodAny,
      ],
    ) as any;
  }

  toDriverScalar(value: HalfvecValue<TConfig> | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql
      ? value.string
      : `[${(value as number[]).join(",")}]`;
  }

  toSQLScalar(value: HalfvecValue<TConfig> | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'[${(value as number[]).join(",")}]'`;
  }

  fromDriverScalar(value: unknown): HalfvecValue<TConfig> | null {
    if (value === null) return null;
    if (Array.isArray(value)) return value as HalfvecValue<TConfig>;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as HalfvecValue<TConfig>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Creates a `halfvec` column. PostgreSQL pgvector half precision vector type, maps to `number[]`.
 *
 * @example
 * ```ts
 * halfvec({ dimensions: 1536, notNull }) // halfvec(1536) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function halfvec<const TConfig extends HalfvecConfig>(
  config: TConfig = {} as TConfig,
) {
  return new HalfvecColumn(config);
}

// ============================================================================
// Sparsevec Column
// ============================================================================

export type SparsevecConfig = ColumnConfig & {
  dimensions?: number;
};

export class SparsevecColumn<TConfig extends SparsevecConfig> extends Column<
  TConfig,
  string,
  "string"
> {
  static readonly id = "Column.Sparsevec";
  readonly #dimensions: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `sparsevec(${this.#dimensions})` : "sparsevec";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.string();
  }

  toDriverScalar(value: string | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): string | null {
    return value;
  }
}

/**
 * Creates a `sparsevec` column. PostgreSQL pgvector sparse vector type, maps to `string`.
 *
 * @example
 * ```ts
 * sparsevec({ dimensions: 1000, notNull }) // sparsevec(1000) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function sparsevec<const TConfig extends SparsevecConfig>(
  config: TConfig = {} as TConfig,
) {
  return new SparsevecColumn(config);
}

// ============================================================================
// Bit (pgvector) Column
// ============================================================================

export type BitConfig = ColumnConfig & {
  length?: number;
};

export class BitColumn<TConfig extends BitConfig> extends Column<
  TConfig,
  string,
  "string"
> {
  static readonly id = "Column.Bit";
  readonly #length: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#length = config.length;
  }

  get sqlTypeScalar(): string {
    return this.#length ? `bit(${this.#length})` : "bit";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    let base = z.string().regex(/^[01]+$/);
    if (this.#length !== undefined) {
      base = base.length(this.#length);
    }
    return base;
  }

  toDriverScalar(value: string | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    // standard bit literal syntax: B'101010'
    return value instanceof Sql ? value.string : `B'${value}'`;
  }

  fromDriverScalar(value: string | null): string | null {
    return value;
  }
}

/**
 * Creates a `bit` column. PostgreSQL bit string type, maps to `string`.
 *
 * @example
 * ```ts
 * bit({ length: 16, notNull }) // bit(16) NOT NULL
 * ```
 *
 * @param config.length - Fixed bit string length
 */
export function bit<const TConfig extends BitConfig>(
  config: TConfig = {} as TConfig,
) {
  return new BitColumn(config);
}

// ============================================================================
// pgvector namespace object
// ============================================================================

/** All pgvector column constructors grouped as a single object. */
export const pgvector = {
  vector,
  halfvec,
  sparsevec,
  bit,
};
