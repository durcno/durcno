import * as z from "zod";
import type { AnyColumn, TableWithColumns } from "../table";

export type BuildZodRefine<TColumns extends Record<string, AnyColumn>> = {
  [K in keyof TColumns]?: (...args: [TColumns[K]["zodType"]]) => z.ZodType;
};

type InferColInsertZodType<
  TColumn extends AnyColumn,
  ZType extends z.ZodType,
> = TColumn extends {
  isGeneratedAlways: true;
}
  ? never
  : TColumn extends { isGeneratedByDefault: true }
    ? z.ZodOptional<ZType>
    : TColumn extends { hasDefault: true }
      ? z.ZodOptional<ZType>
      : TColumn extends { hasDefaultFn: true }
        ? z.ZodOptional<ZType>
        : TColumn extends { isNotNull: true }
          ? ZType
          : z.ZodOptional<ZType>;
type InferInsertZodShape<
  TColumns extends Record<string, AnyColumn>,
  TRefine extends BuildZodRefine<TColumns> | undefined,
> = {
  [K in keyof TColumns]: TRefine extends {}
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

  for (const [columnName, column] of Object.entries(table._.columns)) {
    // Handle different column configurations for insert operations
    if (column.generated === "ALWAYS") {
      // Columns with GENERATED ALWAYS should not be included in insert schema
      continue;
    }

    let zodSchema: z.ZodType = column.zodType;

    if (refine?.[columnName]) {
      zodSchema = refine[columnName](column.zodType);
    }

    if (
      column.generated === "BY DEFAULT" ||
      !column.isNotNull ||
      column.hasDefault ||
      column.hasInsertFn
    ) {
      zodSchema = zodSchema.optional();
    }

    shape[columnName] = zodSchema;
  }

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
  [K in keyof TColumns]: TRefine extends {}
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

  for (const [columnName, column] of Object.entries(table._.columns)) {
    // For update operations, all columns are optional except those with GENERATED ALWAYS
    if (column.isPrimaryKey) {
      // Columns with GENERATED ALWAYS should not be included in update schema
      continue;
    }

    let zodSchema: z.ZodType = column.zodType;

    if (refine?.[columnName]) {
      zodSchema = refine[columnName](column.zodType);
    }
    if (!column.isNotNull) {
      // Nullable columns are nullable
      zodSchema = zodSchema.nullable();
    }
    zodSchema = zodSchema.optional();

    shape[columnName] = zodSchema;
  }

  return z.object(shape) as z.ZodObject<InferUpdateZodShape<TColumns, TRefine>>;
}
