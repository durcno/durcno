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

const ctorBrands = new WeakMap<object, ReadonlySet<string>>();

/** Collects every `entityType` brand declared on a constructor's prototype chain. */
function brandsOf(ctor: object): ReadonlySet<string> {
  const brands = new Set<string>();
  for (let c: object | null = ctor; c; c = Object.getPrototypeOf(c)) {
    const brand = (c as Record<symbol, unknown>)[entityType];
    if (typeof brand === "string") {
      brands.add(brand);
    }
  }
  return brands;
}

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
  const valueType = typeof value;
  if (valueType !== "object" && valueType !== "function") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return false;
  }

  const ctor = proto.constructor as object;
  let brands = ctorBrands.get(ctor);
  if (brands === undefined) {
    brands = brandsOf(ctor);
    ctorBrands.set(ctor, brands);
  }
  return brands.has(type[entityType]);
}

export function isCol(value: any): value is AnyColumn {
  return is(value, Column);
}

export function isTableCol(value: unknown): value is StdTableColumn {
  return isCol(value) && value.table !== undefined;
}

export const isTCol = isTableCol;
