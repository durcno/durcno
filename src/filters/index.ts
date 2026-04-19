import { is, isTCol } from "../entity";
import type { Filter } from "../filters/index";
import { Arg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { SelectQuery } from "../query-builders/select";
import type { Sql } from "../sql";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableColumn,
  TableColumn,
  TableColumnArgs,
  TColsToLeftRight,
} from "../table";

export { Filter } from "./custom";

type ConditionExpression<
  Left extends TableColumnArgs,
  Right extends Record<string, TableColumnArgs>,
  TArg extends boolean = false,
> =
  | EqualValCondition<Left[0], Left[1], Left[2], Left[3], Left[3]["ValType"]>
  | (TArg extends true
      ? EqualValCondition<
          Left[0],
          Left[1],
          Left[2],
          Left[3],
          Arg<Left[3]["ValType"]>
        >
      : never)
  | {
      [RightKey in keyof Right]: EqualColCondition<
        Left[0],
        Left[1],
        Left[2],
        Left[3],
        Right[RightKey][0],
        Right[RightKey][1],
        Right[RightKey][2],
        Right[RightKey][3]
      >;
    }[keyof Right]
  | GreaterEqualValCondition<
      Left[0],
      Left[1],
      Left[2],
      Left[3],
      Left[3]["ValType"] | (TArg extends true ? Arg<Left[3]["ValType"]> : never)
    >
  | {
      [RightKey in keyof Right]: GreaterEqualColCondition<
        Left[0],
        Left[1],
        Left[2],
        Left[3],
        Right[RightKey][0],
        Right[RightKey][1],
        Right[RightKey][2],
        Right[RightKey][3]
      >;
    }[keyof Right]
  | GreaterThanValCondition<
      Left[0],
      Left[1],
      Left[2],
      Left[3],
      Left[3]["ValType"] | (TArg extends true ? Arg<Left[3]["ValType"]> : never)
    >
  | {
      [RightKey in keyof Right]: GreaterThanColCondition<
        Left[0],
        Left[1],
        Left[2],
        Left[3],
        Right[RightKey][0],
        Right[RightKey][1],
        Right[RightKey][2],
        Right[RightKey][3]
      >;
    }[keyof Right]
  | LessThanValCondition<
      Left[0],
      Left[1],
      Left[2],
      Left[3],
      Left[3]["ValType"] | (TArg extends true ? Arg<Left[3]["ValType"]> : never)
    >
  | {
      [RightKey in keyof Right]: LessThanColCondition<
        Left[0],
        Left[1],
        Left[2],
        Left[3],
        Right[RightKey][0],
        Right[RightKey][1],
        Right[RightKey][2],
        Right[RightKey][3]
      >;
    }[keyof Right]
  | LessEqualValCondition<
      Left[0],
      Left[1],
      Left[2],
      Left[3],
      Left[3]["ValType"] | (TArg extends true ? Arg<Left[3]["ValType"]> : never)
    >
  | {
      [RightKey in keyof Right]: LessEqualColCondition<
        Left[0],
        Left[1],
        Left[2],
        Left[3],
        Right[RightKey][0],
        Right[RightKey][1],
        Right[RightKey][2],
        Right[RightKey][3]
      >;
    }[keyof Right]
  | IsNullCondition<Left[0], Left[1], Left[2], Left[3]>
  | InCondition<Left[0], Left[1], Left[2], Left[3], TArg>;

export type BuildFilterExpression<
  TLeftRight extends Record<
    string,
    {
      left: TableColumnArgs;
      right: Record<string, TableColumnArgs>;
    }
  >,
  TArg extends boolean = false,
> =
  | {
      [LeftKey in keyof TLeftRight]: ConditionExpression<
        TLeftRight[LeftKey]["left"],
        TLeftRight[LeftKey]["right"],
        TArg
      >;
    }[keyof TLeftRight]
  | Filter<
      {
        [LeftKey in keyof TLeftRight]: TLeftRight[LeftKey]["left"] extends [
          infer Schema extends string,
          infer TblName extends string,
          infer ColName extends string,
          infer ColType extends AnyColumn,
        ]
          ? TableColumn<Schema, TblName, ColName, ColType>
          : never;
      }[keyof TLeftRight]
    >
  | Sql
  | AndCondition<BuildFilterExpression<TLeftRight, TArg>[]>
  | OrCondition<BuildFilterExpression<TLeftRight, TArg>[]>;

export type StdCondition = BuildFilterExpression<
  TColsToLeftRight<AnyTableWithColumns["_"]["columns"]>
>;

export class EqualValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} = ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} = `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

export class EqualColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} = ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} = ${this.right.fullName}`;
  }
}

export function eq<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): EqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function eq<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): EqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function eq<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): EqualColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function eq(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new EqualColCondition(field, right);
  } else {
    return new EqualValCondition(field, right);
  }
}

class NotEqualValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} != ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} != `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

class NotEqualColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} != ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} != ${this.right.fullName}`;
  }
}

export function ne<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): NotEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function ne<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): NotEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function ne<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): NotEqualColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function ne(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new NotEqualColCondition(field, right);
  } else {
    return new NotEqualValCondition(field, right);
  }
}

export class GreaterEqualValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} >= ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} >= `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

class GreaterEqualColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} >= ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} >= ${this.right.fullName}`;
  }
}

export function gte<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): GreaterEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function gte<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): GreaterEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function gte<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): GreaterEqualColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function gte(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new GreaterEqualColCondition(field, right);
  } else {
    return new GreaterEqualValCondition(field, right);
  }
}

export class GreaterThanValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} > ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} > `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

class GreaterThanColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} > ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} > ${this.right.fullName}`;
  }
}

export function gt<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): GreaterThanValCondition<CTSchema, CTName, CName, Col, TRight>;
export function gt<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): GreaterThanValCondition<CTSchema, CTName, CName, Col, TRight>;
export function gt<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): GreaterThanColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function gt(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new GreaterThanColCondition(field, right);
  } else {
    return new GreaterThanValCondition(field, right);
  }
}

class LessEqualValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} <= ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} <= `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

class LessEqualColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} <= ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} <= ${this.right.fullName}`;
  }
}

export function lte<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): LessEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function lte<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): LessEqualValCondition<CTSchema, CTName, CName, Col, TRight>;
export function lte<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): LessEqualColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function lte(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new LessEqualColCondition(field, right);
  } else {
    return new LessEqualValCondition(field, right);
  }
}

export class LessThanValCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"] | Arg<Col["ValType"]>,
> {
  readonly left: TableColumn<CTSchema, CTName, CName, Col>;
  readonly right: TRight;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>, right: TRight) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} < ${this.left.toSQL(this.right)}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} < `;
    if (is(this.right, Arg)) {
      query.addArg(this.right);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

class LessThanColCondition<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
> {
  readonly left: TableColumn<C1TSchema, C1TName, C1Name, C1>;
  readonly right: TableColumn<C2TSchema, C2TName, C2Name, C2>;
  constructor(
    field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
    right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
  ) {
    this.left = field;
    this.right = right;
  }
  toSQL(): string {
    return `${this.left.fullName} < ${this.right.fullName}`;
  }
  toQuery(query: Query) {
    query.sql += `${this.left.fullName} < ${this.right.fullName}`;
  }
}

export function lt<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Col["ValType"],
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): LessThanValCondition<CTSchema, CTName, CName, Col, TRight>;
export function lt<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TRight extends Arg<Col["ValType"]>,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  right: TRight,
): LessThanValCondition<CTSchema, CTName, CName, Col, TRight>;
export function lt<
  C1TSchema extends string,
  C1TName extends string,
  C1Name extends Key,
  C1 extends AnyColumn,
  C2TSchema extends string,
  C2TName extends string,
  C2Name extends Key,
  C2 extends AnyColumn,
>(
  field: TableColumn<C1TSchema, C1TName, C1Name, C1>,
  right: TableColumn<C2TSchema, C2TName, C2Name, C2>,
): LessThanColCondition<
  C1TSchema,
  C1TName,
  C1Name,
  C1,
  C2TSchema,
  C2TName,
  C2Name,
  C2
>;
export function lt(
  field: StdTableColumn,
  right: AnyColumn["ValType"] | Arg<AnyColumn["ValType"]> | StdTableColumn,
) {
  if (isTCol(right)) {
    return new LessThanColCondition(field, right);
  } else {
    return new LessThanValCondition(field, right);
  }
}

export class IsNullCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
> {
  readonly field: TableColumn<CTSchema, CTName, CName, Col>;
  constructor(field: TableColumn<CTSchema, CTName, CName, Col>) {
    this.field = field;
  }
  toSQL(): string {
    return `${this.field.fullName} IS NULL`;
  }
  toQuery(query: Query) {
    query.sql += `${this.field.fullName} IS NULL`;
  }
}

export function isNull<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
>(field: TableColumn<CTSchema, CTName, CName, Col>) {
  return new IsNullCondition(field);
}

export class IsNotNullCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
> {
  readonly field: TableColumn<CTSchema, CTName, CName, Col>;

  constructor(field: TableColumn<CTSchema, CTName, CName, Col>) {
    this.field = field;
  }

  toSQL(): string {
    return `${this.field.fullName} IS NOT NULL`;
  }
  toQuery(query: Query) {
    query.sql += `${this.field.fullName} IS NOT NULL`;
  }
}

export function isNotNull<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
>(field: TableColumn<CTSchema, CTName, CName, Col>) {
  return new IsNotNullCondition(field);
}

type InSelectQuery<TArg extends boolean, TReturn> = SelectQuery<
  any,
  any,
  any,
  any,
  any,
  TArg,
  any,
  any,
  Record<string, TReturn>[]
>;

export class InCondition<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
  TArg extends boolean,
> {
  readonly field: TableColumn<CTSchema, CTName, CName, Col>;
  readonly values: Col["ValType"][] | InSelectQuery<TArg, Col["ValType"]>;
  constructor(
    field: TableColumn<CTSchema, CTName, CName, Col>,
    values: Col["ValType"][] | InSelectQuery<TArg, Col["ValType"]>,
  ) {
    this.field = field;
    this.values = values;
  }
  toSQL(): string {
    if (Array.isArray(this.values)) {
      if (this.values.length === 0) {
        return "FALSE";
      }
      return `${this.field.fullName} IN (${this.values.map((v) => this.field.toSQL(v)).join(", ")})`;
    } else {
      return `${this.field.fullName} IN (${this.values.toQuery()})`;
    }
  }
  toQuery(query: Query) {
    if (Array.isArray(this.values)) {
      if (this.values.length === 0) {
        query.sql += "FALSE";
        return;
      }
      query.sql += `${this.field.fullName} IN (`;
      query.sql += this.values.map((v) => this.field.toSQL(v)).join(", ");
      query.sql += ")";
    } else {
      query.sql += `${this.field.fullName} IN (`;
      query.sql += this.values.toQuery();
      query.sql += ")";
    }
  }
}

export function isIn<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
>(
  field: TableColumn<CTSchema, CTName, CName, Col>,
  values: Col["ValType"][] | InSelectQuery<boolean, Col["ValType"]>,
) {
  return new InCondition(field, values);
}

export class AndCondition<
  // biome-ignore lint/suspicious/noExplicitAny: Recursive evaluation requires any
  TConditions extends any[],
> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    this.conditions = conditions;
  }
  toSQL(): string {
    let sql = "";
    for (let i = 0; i < this.conditions.length; i++) {
      sql += this.conditions[i].toSQL();
      if (i < this.conditions.length - 1) {
        sql += " AND ";
      }
    }
    return sql;
  }
  toQuery(query: Query) {
    for (let i = 0; i < this.conditions.length; i++) {
      this.conditions[i].toQuery(query);
      if (i < this.conditions.length - 1) {
        query.sql += " AND ";
      }
    }
  }
}

export function and<
  // biome-ignore lint/suspicious/noExplicitAny: Recursive evaluation requires any
  TConditions extends any[],
>(...conditions: TConditions) {
  return new AndCondition(...conditions);
}

export class OrCondition<
  // biome-ignore lint/suspicious/noExplicitAny: Recursive evaluation requires any
  TConditions extends any[],
> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    this.conditions = conditions;
  }
  toSQL(): string {
    let sql = "";
    for (let i = 0; i < this.conditions.length; i++) {
      sql += this.conditions[i].toSQL();
      if (i < this.conditions.length - 1) {
        sql += " OR ";
      }
    }
    return sql;
  }

  toQuery(query: Query) {
    for (let i = 0; i < this.conditions.length; i++) {
      this.conditions[i].toQuery(query);
      if (i < this.conditions.length - 1) {
        query.sql += " OR ";
      }
    }
  }
}

export function or<
  // biome-ignore lint/suspicious/noExplicitAny: Recursive evaluation requires any
  TConditions extends any[],
>(...conditions: TConditions) {
  return new OrCondition(...conditions);
}
