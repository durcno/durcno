/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import { Column } from "./columns/common";
import { entityType } from "./symbols";
import type { AnyColumn, StdTableColumn } from "./table";

export type DurcnoEntity<T> = (
  | (abstract new (
      ...args: any[]
    ) => T)
  | (new (
      ...args: any[]
    ) => T)
) & {
  [entityType]: string;
};

export function is<T extends DurcnoEntity<any>>(
  value: any,
  type: T,
): value is InstanceType<T> {
  if (value === null || value === undefined) {
    return false;
  }
  if (value instanceof type) {
    return true;
  }

  let cls = Object.getPrototypeOf(value).constructor;
  if (cls) {
    // Traverse the prototype chain to find the entityKind
    while (cls) {
      if (entityType in cls && cls[entityType] === type[entityType]) {
        return true;
      }
      cls = Object.getPrototypeOf(cls);
    }
  }

  return false;
}

export function isCol(value: any): value is AnyColumn {
  return is(value, Column);
}

export function isTableCol(value: unknown): value is StdTableColumn {
  return isCol(value) && value.table !== undefined;
}

export const isTCol = isTableCol;
