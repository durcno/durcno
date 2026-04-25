/**
 * Builds a quoted relation name from schema and name.
 * Examples:
 * - schema="public", name="users" -> "public"."users"
 */
export function buildRelation(schema: string, name: string): string {
  return `"${schema}"."${name}"`;
}
