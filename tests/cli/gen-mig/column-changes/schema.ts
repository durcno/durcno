import { integer, Migrations, notNull, pk, table, text, varchar } from "durcno";

export { Migrations };

// Scenarios (sequential ALTER COLUMN migrations):
// - Stage 1: initial articles table
//     title: varchar(100) notNull
//     body:  text (nullable)
//     views: integer (nullable, no default)
// - Stage 2: change title type from varchar(100) to text  (alterColumnType)
// - Stage 3: add NOT NULL to body                         (setNotNull)
// - Stage 4: drop NOT NULL from body                      (dropNotNull)
// - Stage 5: set default 0 on views                       (setDefault)
// - Stage 6: drop default from views                      (dropDefault)

const stage = Number(process.env.STAGE ?? 1);

export const Articles = table("public", "articles", {
  id: pk(),
  // Stage 1: varchar(100) notNull; Stage 2+: text notNull
  title: stage >= 2 ? text({ notNull }) : varchar({ length: 100, notNull }),
  // Stage 1-2: nullable; Stage 3: notNull; Stage 4+: nullable again
  body: stage === 3 ? text({ notNull }) : text({}),
  // Stage 1-4: nullable no default; Stage 5: default 0; Stage 6+: no default again
  views: stage === 5 ? integer({}).default(0) : integer({}),
});
