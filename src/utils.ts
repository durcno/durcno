/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
export function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // handles consecutive caps: "XMLParser" → "xml_parser"
    .replace(/([a-z])([A-Z])/g, "$1_$2") // handles standard: "camelCase" → "camel_case"
    .toLowerCase();
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
