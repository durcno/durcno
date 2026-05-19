import type { CamelToSnake, SnakeCase } from "./types";

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
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // handles consecutive caps: "XMLParser" → "xml_parser"
    .replace(/([a-z])([A-Z])/g, "$1_$2") // handles standard: "camelCase" → "camel_case"
    .toLowerCase() as SnakeCase<CamelToSnake<T>>;
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

export function memoize<F extends (...args: any[]) => any>(func: F): F {
  const cache: Record<string, ReturnType<F>> = {};
  return ((...args) => {
    // Generate a unique key for the arguments.
    // JSON.stringify is a simple way to create a key from complex arguments.
    const key = JSON.stringify(args);

    // Check if the result for these arguments is already in the cache
    if (cache[key]) {
      return cache[key];
    } else {
      // If not in cache, call the original function and store the result
      const result = func(...args);
      cache[key] = result;
      return result;
    }
  }) as F;
}
