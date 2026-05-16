import * as z from "zod";
import type { AnyColumn, TableAnyColumn, TableWithColumns } from "../table";

export type BuildZodRefine<TColumns extends Record<string, AnyColumn>> = {
  [K in keyof TColumns]?: (...args: [TColumns[K]["zodType"]]) => z.ZodType;
};

type InferColInsertZodType<
  TColumn extends AnyColumn,
  ZType extends z.ZodType,
> = TColumn["isGeneratedAlways"] extends true
  ? never
  : TColumn["isGeneratedByDefault"] extends true
    ? z.ZodOptional<ZType>
    : TColumn["isNotNull"] extends true
      ? TColumn["hasInsertFn"] | TColumn["hasDefault"] extends true
        ? z.ZodOptional<ZType>
        : ZType
      : z.ZodOptional<z.ZodNullable<ZType>>;
type InferInsertZodShape<
  TColumns extends Record<string, AnyColumn>,
  TRefine extends BuildZodRefine<TColumns> | undefined,
> = {
  [K in keyof TColumns]: TRefine extends Record<string, unknown>
    ? TRefine[K] extends (...args: any[]) => infer U
      ? U extends z.ZodType
        ? InferColInsertZodType<TColumns[K], U>
        : never
      : InferColInsertZodType<TColumns[K], TColumns[K]["zodType"]>
    : InferColInsertZodType<TColumns[K], TColumns[K]["zodType"]>;
} extends infer U
  ? { [K in keyof U as U[K] extends never ? never : K]: U[K] }
  : never;

export function createInsertSchema<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TRefine extends BuildZodRefine<TColumns>,
>(
  table: TableWithColumns<TTSchema, TTName, TColumns>,
  refine?: TRefine,
): z.ZodObject<InferInsertZodShape<TColumns, TRefine>> {
  const shape: Record<string, z.ZodType> = {};

  Object.entries(table._.columns).forEach((entry) => {
    const [columnName, column] = entry as [string, TableAnyColumn];
    if (column.isGeneratedAlways) return;

    let zodSchema: z.ZodType = column.zodType;

    if (refine?.[columnName]) {
      zodSchema = refine[columnName](column.zodType);
    }

    if (column.isGeneratedByDefault) {
      zodSchema = zodSchema.optional();
    } else {
      if (column.isNotNull) {
        if (column.hasInsertFn || column.hasDefault) {
          zodSchema = zodSchema.optional();
        }
      } else {
        zodSchema = zodSchema.nullable().optional();
      }
    }

    shape[columnName] = zodSchema;
  });

  return z.object(shape) as z.ZodObject<InferInsertZodShape<TColumns, TRefine>>;
}

type InferColUpdateZodType<
  TColumn extends AnyColumn,
  ZType extends z.ZodType,
> = TColumn["isPrimaryKey"] extends true
  ? never
  : TColumn["isNotNull"] extends true
    ? z.ZodOptional<ZType>
    : z.ZodOptional<z.ZodNullable<ZType>>;

type InferUpdateZodShape<
  TColumns extends Record<string, AnyColumn>,
  TRefine extends BuildZodRefine<TColumns> | undefined,
> = {
  [K in keyof TColumns]: TRefine extends Record<string, unknown>
    ? TRefine[K] extends (...args: any[]) => infer U
      ? U extends z.ZodType
        ? InferColUpdateZodType<TColumns[K], U>
        : never
      : InferColUpdateZodType<TColumns[K], TColumns[K]["zodType"]>
    : InferColUpdateZodType<TColumns[K], TColumns[K]["zodType"]>;
} extends infer U
  ? { [K in keyof U as U[K] extends never ? never : K]: U[K] }
  : never;

export function createUpdateSchema<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TRefine extends BuildZodRefine<TColumns>,
>(
  table: TableWithColumns<TTSchema, TTName, TColumns>,
  refine?: TRefine,
): z.ZodObject<InferUpdateZodShape<TColumns, TRefine>> {
  const shape: Record<string, z.ZodType> = {};

  Object.entries(table._.columns).forEach((entry) => {
    const [columnName, column] = entry as [string, TableAnyColumn];

    if (column.isPrimaryKey) return;

    let zodSchema: z.ZodType = column.zodType;

    if (refine?.[columnName]) {
      zodSchema = refine[columnName](column.zodType);
    }

    if (column.isNotNull) {
      zodSchema = zodSchema.optional();
    } else {
      zodSchema = zodSchema.nullable().optional();
    }

    shape[columnName] = zodSchema;
  });

  return z.object(shape) as z.ZodObject<InferUpdateZodShape<TColumns, TRefine>>;
}
