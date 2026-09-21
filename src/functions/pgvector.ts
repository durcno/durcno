import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyColumn } from "../table";
import { SqlFn, type StrictFnReturn } from "./index";

export type VectorCol = AnyColumn & {
  ValType: number[];
  $?: { PgType: "numeric" | "float" };
};

export type BitCol = AnyColumn & {
  ValType: string;
  $?: { PgType: "string" };
};

export class DistanceFn<
  TCol extends AnyColumn,
  TOp extends string = string,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null =
    | TCol["ValType"]
    | Arg<TCol["ValType"]>
    | null,
  TTsType = StrictFnReturn<[TCol, TVal], number>,
> extends SqlFn<TCol, IsArg<TVal>, "scalar", "numeric", TTsType> {
  constructor(
    private readonly col: TCol,
    private readonly val: TVal,
    private readonly op: TOp,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._numericToSQL(value as number | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._numericFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += ` ${this.op} `;

    if (this.val === null) {
      query.sql += "NULL";
    } else if (is(this.val, Arg<TCol["ValType"]>)) {
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
): DistanceFn<
  TCol,
  "<->",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<->",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<->", null, null>;
export function l2Distance<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<->", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function l2Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<->",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<->");
}

/** Computes the inner product using the `<#>` operator. */
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<
  TCol,
  "<#>",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<#>",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<#>", null, null>;
export function innerProduct<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<#>", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function innerProduct<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<#>",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<#>");
}

/** Computes the cosine distance using the `<=>` operator. */
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<
  TCol,
  "<=>",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<=>",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<=>", null, null>;
export function cosineDistance<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<=>", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function cosineDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<=>",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<=>");
}

/** Computes the L1 distance using the `<+>` operator. */
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<
  TCol,
  "<+>",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<+>",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<+>", null, null>;
export function l1Distance<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<+>", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function l1Distance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<+>",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<+>");
}

/** Computes the Hamming distance using the `<~>` operator. */
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<
  TCol,
  "<~>",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<~>",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<~>", null, null>;
export function hammingDistance<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<~>", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function hammingDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<~>",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<~>");
}

/** Computes the Jaccard distance using the `<%>` operator. */
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"],
): DistanceFn<
  TCol,
  "<%>",
  TCol["ValType"],
  StrictFnReturn<[TCol, TCol["ValType"]], number>
>;
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: Arg<TCol["ValType"]>,
): DistanceFn<
  TCol,
  "<%>",
  Arg<TCol["ValType"]>,
  StrictFnReturn<[TCol, Arg<TCol["ValType"]>], number>
>;
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: null,
): DistanceFn<TCol, "<%>", null, null>;
export function jaccardDistance<
  TCol extends AnyColumn,
  TVal extends TCol["ValType"] | Arg<TCol["ValType"]> | null,
>(
  col: TCol,
  val: TVal,
): DistanceFn<TCol, "<%>", TVal, StrictFnReturn<[TCol, TVal], number>>;
export function jaccardDistance<TCol extends AnyColumn>(
  col: TCol,
  val: TCol["ValType"] | Arg<TCol["ValType"]> | null,
): DistanceFn<
  TCol,
  "<%>",
  typeof val,
  StrictFnReturn<[TCol, typeof val], number>
> {
  return new DistanceFn(col, val, "<%>");
}
