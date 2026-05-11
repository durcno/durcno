export type BasicTypes = string | number | bigint | boolean | null;

export type CamelToSnake<S extends string> =
  S extends `${infer Head}${infer Tail}`
    ? Head extends Uppercase<Head>
      ? `_${Lowercase<Head>}${CamelToSnake<Tail>}`
      : `${Head}${CamelToSnake<Tail>}`
    : S;

export type Key = string | number | symbol;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type Valueof<T> = T extends any ? T[keyof T] : never;

export type SelfOrArray<T> = T | T[];
export type SelfOrReadonly<T> = T | Readonly<T>;
export type Or<T, U> = T extends true ? true : U extends true ? true : false;

export type UnionToIntersection<U> =
  // biome-ignore lint/suspicious/noExplicitAny: <>
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

export type Is<T, U> = T extends U ? true : false;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};
