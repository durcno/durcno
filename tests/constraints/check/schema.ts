import {
  and,
  bigint,
  gt,
  gte,
  integer,
  isIn,
  length,
  like,
  lt,
  lte,
  notIn,
  notNull,
  pk,
  table,
  varchar,
} from "durcno";

export { Migrations } from "durcno";

/**
 * Table covering scalar check constraints:
 * - gt / lt on bigint (price)
 * - gte / lte / and on integer (quantity)
 * - LIKE on varchar (email)
 * - function length + fnGt / fnLte on camelCase column (userName)
 */
export const Products = table(
  "public",
  "products",
  {
    id: pk(),
    price: bigint({ notNull }),
    quantity: integer({ notNull }),
    email: varchar({ length: 255 }),
    userName: varchar({ length: 100, notNull }),
  },
  {
    checkConstraints: (t, check) => [
      check("positive_price", gt(t.price, 0n)),
      check("max_price", lt(t.price, 1_000_000n)),
      check("valid_quantity", and(gte(t.quantity, 0), lte(t.quantity, 10000))),
      check("valid_email", like(t.email, "%@%.%")),
      check(
        "name_length",
        and(gt(length(t.userName), 2), lte(length(t.userName), 100)),
      ),
    ],
  },
);

/**
 * Table covering IN / NOT IN check constraints.
 * Also covers an IN check on the integer array `dimensions` column —
 * only ARRAY[2] and ARRAY[3] are allowed. Because `inOp` in CheckBuilder is
 * typed for scalar (string | number) values, array equality uses `raw` SQL
 * which emits the same IN semantics: `"dimensions" IN (ARRAY[2], ARRAY[3])`.
 */
export const Orders = table(
  "public",
  "orders",
  {
    id: pk(),
    categoryId: integer({ notNull }),
    status: varchar({ length: 50, notNull }),
    array: integer({ notNull, dimension: [null] as const }),
  },
  {
    checkConstraints: (t, check) => [
      check("valid_category", isIn(t.categoryId, [1, 2, 3])),
      check("excluded_category", notIn(t.categoryId, [99, 100])),
      check("valid_status", isIn(t.status, ["active", "pending", "closed"])),
      check(
        "valid_array",
        isIn(t.array, [
          [1, 2],
          [2, 1],
        ]),
      ),
    ],
  },
);
