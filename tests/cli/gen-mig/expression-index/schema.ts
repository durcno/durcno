import {
  index,
  lower,
  Migrations,
  notNull,
  pk,
  sql,
  table,
  text,
  toTsvector,
  uniqueIndex,
  varchar,
} from "durcno";

export { Migrations };

// Scenarios (sequential expression index migrations):
// - Stage 1: function-builder GIN expression indexes,
//            plus a unique expression index on lower(title)
// - Stage 2: change the toTsvector configuration (drop + recreate)
// - Stage 3: remove all expression indexes without dropping columns
// - Stage 4: partial index predicate containing backtick and `${` literals

const stage = Number(process.env.STAGE ?? 1);

export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    title: varchar({ length: 255, notNull }),
    content: text({ notNull }),
  },
  {
    indexes: (t) => {
      const indexes = [];

      if (stage === 1) {
        indexes.push(
          index("posts_content_tsv_idx", [
            toTsvector(t.content, "english"),
          ]).using("gin"),
        );
      }

      if (stage === 2) {
        indexes.push(
          index("posts_content_tsv_idx", [
            toTsvector(t.content, "simple"),
          ]).using("gin"),
        );
      }

      if (stage <= 2) {
        indexes.push(
          index("posts_title_tsv_idx", [toTsvector(t.title, "english")]).using(
            "gin",
          ),
        );
        indexes.push(uniqueIndex("posts_lower_title_uidx", [lower(t.title)]));
      }

      if (stage === 4) {
        indexes.push(
          index("posts_content_tick_idx", [t.content]).where(
            sql`"content" <> 'a\`b\${c}'`,
          ),
        );
      }

      return indexes;
    },
  },
);
