import {
  bigint,
  integer,
  Migrations,
  notNull,
  now,
  pk,
  table,
  timestamp,
  varchar,
} from "durcno";

export { Migrations };

// Scenarios:
// - initial: base checks
// - add: add a new check (max_price)
// - remove: remove the valid_email check
// - modify: change valid_quantity upper bound from 10000 -> 1000

const scenario = (process.env.CHECK_SCENARIO ?? "initial") as
  | "initial"
  | "add"
  | "remove"
  | "modify";

export const CheckTest = table(
  "public",
  "check_test",
  {
    id: pk(),
    price: bigint({ notNull }),
    quantity: integer({ notNull }),
    email: varchar({ length: 255 }),
    name: varchar({ length: 100, notNull }),
    createdAt: timestamp({ notNull, default: now() }),
  },
  {
    checkConstraints: (
      t,
      check,
      { gt, lt, and, gte, lte, like, fnGt, fnLte, length },
    ) => {
      const base = [
        check("positive_price", gt(t.price, 0)),
        check(
          "valid_quantity",
          and(gte(t.quantity, 0), lte(t.quantity, 10000)),
        ),
        check("valid_email", like(t.email, "%@%.%")),
        check(
          "name_length",
          and(fnGt(length(t.name), 2), fnLte(length(t.name), 100)),
        ),
      ];

      if (scenario === "initial") return base;

      if (scenario === "add") {
        return [...base, check("max_price", lt(t.price, 1000000))];
      }

      if (scenario === "remove") {
        return base.filter(
          (ck) => ck.getName().endsWith("valid_email_check") === false,
        );
      }

      if (scenario === "modify") {
        // Change valid_quantity to upper bound 1000
        return [
          check("positive_price", gt(t.price, 0)),
          check(
            "valid_quantity",
            and(gte(t.quantity, 0), lte(t.quantity, 1000)),
          ),
          check("valid_email", like(t.email, "%@%.%")),
          check(
            "name_length",
            and(fnGt(length(t.name), 2), fnLte(length(t.name), 100)),
          ),
        ];
      }

      return base;
    },
  },
);
