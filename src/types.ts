export type BasicTypes = string | number | bigint | boolean | null;
export type SqlArgType = string | number | bigint | boolean | null;

/** A raw row as returned by a PostgreSQL driver: column name to driver value. */
export type RawRow = Record<string, unknown>;

declare const camelCaseBrand: unique symbol;
declare const snakeCaseBrand: unique symbol;

/** A string branded as being in camelCase form. */
export type CamelCase<T extends string = string> = T & {
  readonly [camelCaseBrand]: true;
};

/** A string branded as being in snake_case form. Produced by {@link camelToSnake}. */
export type SnakeCase<T extends string = string> = T & {
  readonly [snakeCaseBrand]: true;
};

export type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? `_${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Head}${CamelToSnake<Tail>}`
    : S;

export type Key = string | number | symbol;

export type Valueof<T> = T extends unknown ? T[keyof T] : never;

export type SelfOrArray<T> = T | T[];
export type SelfOrReadonly<T> = T | Readonly<T>;
/** A single type-level flag as a boolean: `never` reads as `false`. */
type OrFalse<T> = [T] extends [never] ? false : T extends true ? true : false;

/** Boolean OR for type flags; `never` reads as `false`. */
export type Or<T, U> = [T] extends [never]
  ? OrFalse<U>
  : T extends true
    ? true
    : OrFalse<U>;

/** Turns a union of function parameter types into an intersection. */
type Distribute<U> = U extends unknown ? (k: U) => void : never;

export type UnionToIntersection<U> =
  Distribute<U> extends (k: infer I) => void ? I : never;

export type Is<T, U> = T extends U ? true : false;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};
