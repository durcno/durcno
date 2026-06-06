import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyColumn } from "../table";
import { SqlFn } from "./index";

export type VectorCol = AnyColumn & {
  ValType: number[];
  $?: { PgType: "numeric" };
};

export type BitCol = AnyColumn & {
  ValType: string;
  $?: { PgType: "string" };
};

export class DistanceFn<
  TCol extends AnyColumn,
  TOp extends string = string,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> =
    | TCol["ValType"]
    | Arg<TCol["ValType"]>,
> extends SqlFn<TCol, IsArg<TVal>, "scalar", "numeric", number> {
  constructor(
    private readonly col: TCol,
    private readonly val: TVal,
    private readonly op: TOp,
  ) {
    super();
  }

  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    return SqlFn._numericFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += ` ${this.op} `;

    if (is(this.val, Arg<TCol["ValType"]>)) {
      query.addArg(this.val);
    } else {
      query.sql += this.col.toSQL(this.val, { cast: true });
    }
  }
}

/** Computes the L2 distance using the `<->` operator. */
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<->", TCol["ValType"]>;
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<->", Arg<TCol["ValType"]>>;
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<->", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<->");
}

/** Computes the inner product using the `<#>` operator. */
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<#>", TCol["ValType"]>;
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<#>", Arg<TCol["ValType"]>>;
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<#>", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<#>");
}

/** Computes the cosine distance using the `<=>` operator. */
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<=>", TCol["ValType"]>;
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<=>", Arg<TCol["ValType"]>>;
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<=>", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<=>");
}

/** Computes the L1 distance using the `<+>` operator. */
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<+>", TCol["ValType"]>;
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<+>", Arg<TCol["ValType"]>>;
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<+>", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<+>");
}

/** Computes the Hamming distance using the `<~>` operator. */
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<~>", TCol["ValType"]>;
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<~>", Arg<TCol["ValType"]>>;
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<~>", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<~>");
}

/** Computes the Jaccard distance using the `<%>` operator. */
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<TCol, "<%>", TCol["ValType"]>;
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<%>", Arg<TCol["ValType"]>>;
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]>,
): DistanceFn<TCol, "<%>", TCol["ValType"] | Arg<TCol["ValType"]>> {
  return new DistanceFn(col, val, "<%>");
}
