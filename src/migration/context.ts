import type { QueryContext } from "../query-builders/query";
import { camelToSnake } from "../utils";

/**
 * Builds a query context that renders columns of a table without a table
 * qualifier. Includes raw and snake_case spellings so DDL callers can pass
 * either form.
 * @internal
 */
export function createUnqualifiedTableContext(
  schema: string,
  table: string,
): QueryContext {
  return {
    tableAliases: new Map([
      [`${schema}.${table}`, null],
      [`${camelToSnake(schema)}.${camelToSnake(table)}`, null],
    ]),
  };
}
