import type { db } from "./schema";
import { Expect } from "./utils";

// `database()` splits schema exports into tables and relation factories; only
// tables may appear in the table map, otherwise `insertInto`/`update`/`deleteFrom`
// accept entities that are not tables.
type TableKeys = keyof (typeof db.$)["tables"];

type _HasUsers = "Users" extends TableKeys ? true : false;
Expect<_HasUsers>;

type _HasPosts = "Posts" extends TableKeys ? true : false;
Expect<_HasPosts>;

type _ExcludesRelationFactories = "UsersRelations" extends TableKeys
  ? false
  : true;
Expect<_ExcludesRelationFactories>;

type _ExcludesPostRelations = "PostsRelations" extends TableKeys ? false : true;
Expect<_ExcludesPostRelations>;
