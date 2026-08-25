/** biome-ignore-all lint/correctness/noUnusedImports: <> */
/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import {
  index,
  integer,
  Migrations,
  notNull,
  pk,
  table,
  text,
  varchar,
} from "durcno";

export { Migrations };

// Scenarios (sequential index + column migrations):
// - Stage 1: initial products table with an indexed "sku" column
//     id:    serial pk
//     name:  varchar(255) notNull
//     sku:   varchar(100) notNull (indexed)
// - Stage 2: add a "category" column with a new index (addColumn + createIndex)
// - Stage 3: drop the "sku" column and its index (dropIndex + dropColumn)
// - Stage 4: remove the "category" index without dropping the column (dropIndex only)

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
