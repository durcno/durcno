import {
  and,
  bigint,
  gt,
  gte,
  integer,
  length,
  like,
  lt,
  lte,
  Migrations,
  notNull,
  now,
  pk,
  table,
  timestamp,
  varchar,
} from "durcno";

export { Migrations };

// Stage 1: base checks (positive_price, valid_quantity[0-10000], valid_email, name_length)
// Stage 2: add max_price check (price < 1000000)
// Stage 3: remove valid_email check (keep max_price)
// Stage 4: modify valid_quantity upper bound from 10000 to 1000

const stage = Number(process.env.STAGE ?? 1);

export const CheckTest = table(
  "public",
  "checkTest",
  {
    id: pk(),
    price: bigint({ notNull }),
    quantity: integer({ notNull }),
    email: varchar({ length: 255 }),
    name: varchar({ length: 100, notNull }),
    createdAt: timestamp({ notNull }).default(now()),
  },
  {
    checkConstraints: (t, check) => {
      const quantityMax = stage >= 4 ? 1000 : 10000;

      const checks = [
        check("check_check_test_positive_price", gt(t.price, 0n)),
        check(
          "check_check_test_valid_quantity",
          and(gte(t.quantity, 0), lte(t.quantity, quantityMax)),
        ),
        ...(stage <= 2
          ? [check("check_check_test_valid_email", like(t.email, "%@%.%"))]
          : []),
        check(
          "check_check_test_name_length",
          and(gt(length(t.name), 2), lte(length(t.name), 100)),
        ),
        ...(stage >= 2
          ? [check("check_check_test_max_price", lt(t.price, 1000000n))]
          : []),
      ];

      return checks;
    },
  },
);
