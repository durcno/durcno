import type { CamelToSnake, SnakeCase } from "./types";

/**
 * Cache of already-converted identifiers.
 */
const camelToSnakeCache = new Map<string, string>();

/**
 * Converts a camelCase or PascalCase string to snake_case.
 * Returns a {@link SnakeCase}-branded value so the type system can distinguish
 * converted identifiers from raw user-supplied strings.
 *
 * @param str - The camelCase or PascalCase identifier to convert.
 * @returns The snake_case equivalent, branded as {@link SnakeCase}.
 */
export function camelToSnake<T extends string>(
  str: T,
): SnakeCase<CamelToSnake<T>> {
  const cached = camelToSnakeCache.get(str);
  if (cached !== undefined) return cached as SnakeCase<CamelToSnake<T>>;
  const snake = str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // handles consecutive caps: "XMLParser" → "xml_parser"
    .replace(/([a-z])([A-Z])/g, "$1_$2") // handles standard: "camelCase" → "camel_case"
    .toLowerCase();
  camelToSnakeCache.set(str, snake);
  return snake as SnakeCase<CamelToSnake<T>>;
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export async function tryCatch<T>(
  fn: () => T,
): Promise<[T, null] | [null, any]> {
  try {
    return [await fn(), null];
  } catch (error: any) {
    return [null, error];
  }
}
