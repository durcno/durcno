/**
 * Ensures every vector element is a finite number before it is rendered into
 * SQL. Values can arrive from unvalidated JSON, where `number[]` is only a
 * compile-time claim.
 */
export function assertFiniteVector(value: readonly number[]): void {
  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid vector value: expected an array of finite numbers.",
    );
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(
        `Invalid vector element at index ${i}: expected a finite number.`,
      );
    }
  }
}
