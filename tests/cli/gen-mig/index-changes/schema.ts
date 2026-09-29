/** biome-ignore-all lint/correctness/noUnusedImports: <> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import {
  eq,
  index,
  integer,
  isNull,
  Migrations,
  notNull,
  pk,
  table,
  text,
  timestamptz,
  uniqueIndex,
  varchar,
} from "durcno";

export { Migrations };

// Scenarios (sequential index + column migrations):
// - Stage 1: initial products table with an indexed "sku" column,
//            and users table with partial indexes (unique on active email, index on active status)
// - Stage 2: add a "category" column with a new index (addColumn + createIndex) on products;
//            modify partial index on users (status WHERE status = 'archived')
// - Stage 3: drop the "sku" column and its index (dropIndex + dropColumn) on products;
//            drop the "users_status_idx" partial index from users
// - Stage 4: remove the "category" index without dropping the column (dropIndex only) on products;
//            users retains active email unique index

const stage = Number(process.env.STAGE ?? 1);

export const Products = table(
  "public",
  "products",
  {
    id: pk(),
    name: varchar({ length: 255, notNull }),
    // Stage 1-2: sku exists; Stage 3+: sku is removed
    ...(stage < 3 ? { sku: varchar({ length: 100, notNull }) } : {}),
    // Stage 2+: category is added
    ...(stage >= 2 ? { category: varchar({ length: 100 }) } : {}),
  },
  {
    indexes: (t) => {
      const idxs: ReturnType<typeof index>[] = [];
      // Stage 1-2: index on sku
      if (stage < 3 && "sku" in t) {
        idxs.push(index([(t as any).sku]));
      }
      // Stage 2-3: index on category
      if (stage >= 2 && stage < 4 && "category" in t) {
        idxs.push(index([(t as any).category]));
      }
      return idxs as any;
    },
  },
);

export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255, notNull }),
    status: varchar({ length: 50, notNull }),
    deletedAt: timestamptz({}),
  },
  {
    indexes: (t) => {
      const idxs = [];

      // Stage 1+: partial unique index for soft deletes
      idxs.push(
        uniqueIndex("users_active_email_idx", [t.email]).where(
          isNull(t.deletedAt),
        ),
      );

      // Stage 1: partial index where status = 'active'
      if (stage === 1) {
        idxs.push(
          index("users_status_idx", [t.status]).where(eq(t.status, "active")),
        );
      }

      // Stage 2: modified partial index where status = 'archived'
      if (stage === 2) {
        idxs.push(
          index("users_status_idx", [t.status]).where(eq(t.status, "archived")),
        );
      }

      // Stage 3+: users_status_idx is removed

      return idxs;
    },
  },
);
