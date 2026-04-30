import { asc, desc, eq } from "durcno";
import { Articles, Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: query on Users
const allQr = db.query(Users).findMany({});
type AllQueryRtrn = Awaited<typeof allQr>;
Expect<
  Equal<
    AllQueryRtrn,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: query on Users /w columns true
const manyWtColsQr = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    email: true,
    type: true,
  },
});
type ManyWtColsTrueRtrn = Awaited<typeof manyWtColsQr>;
Expect<
  Equal<
    ManyWtColsTrueRtrn,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>;

// Type test: query on Users /w columns false
const manyWtColsFalseQr = db.query(Users).findMany({
  columns: {
    id: false,
    createdAt: false,
  },
});

type ManyWtColsFalseRtrn = Awaited<typeof manyWtColsFalseQr>;
Expect<
  Equal<
    ManyWtColsFalseRtrn,
    {
      username: string;
      email: string | null;
      type: "admin" | "user";
      externalId: string;
      trackingId: string | null;
    }[]
  >
>;

// Type test: query on Users with where
const whereQr = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    email: true,
    type: true,
  },
  where: eq(Users.type, "user"),
});
type WhereQueryRtrn = Awaited<typeof whereQr>;
Expect<
  Equal<
    WhereQueryRtrn,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>;

// Type test: query on Users with orderBy (single column)
const orderByQr = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
  },
  orderBy: asc(Users.username),
});
type OrderByQueryRtrn = Awaited<typeof orderByQr>;
Expect<
  Equal<
    OrderByQueryRtrn,
    {
      id: bigint;
      username: string;
    }[]
  >
>;

// Type test: query on Users with orderBy (multi-column array)
const multiOrderByQr = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    createdAt: true,
  },
  orderBy: [asc(Users.username), desc(Users.createdAt)],
});
type MultiOrderByQueryRtrn = Awaited<typeof multiOrderByQr>;
Expect<
  Equal<
    MultiOrderByQueryRtrn,
    {
      id: bigint;
      username: string;
      createdAt: Date;
    }[]
  >
>;

// Type test: query on Users with Profile
const usersWithProfileQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    email: true,
    type: true,
  },
  with: {
    profile: {
      columns: {
        bio: true,
        avatarUrl: true,
      },
    },
  },
});
type UsersWithProfileQueryRtrn = Awaited<typeof usersWithProfileQuery>;
Expect<
  Equal<
    UsersWithProfileQueryRtrn,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      profile: {
        bio: string | null;
        avatarUrl: string | null;
      } | null;
    }[]
  >
>;

// Type test: query on Posts with Comments
const postsWithCommentsQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    userId: true,
    title: true,
    content: true,
  },
  with: {
    comments: {
      columns: {
        id: true,
        body: true,
      },
    },
  },
});
type PostsWithCommentsQueryRtrn = Awaited<typeof postsWithCommentsQuery>;
Expect<
  Equal<
    PostsWithCommentsQueryRtrn,
    {
      id: bigint;
      userId: bigint;
      title: string | null;
      content: string | null;
      comments: {
        id: bigint;
        body: string | null;
      }[];
    }[]
  >
>;

// Type test: fk relation with notNull FK column - result should be T (not nullable)
const postsWithAuthorQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    author: {
      columns: {
        id: true,
        username: true,
      },
    },
  },
});
type PostsWithAuthorQueryRtrn = Awaited<typeof postsWithAuthorQuery>;
Expect<
  Equal<
    PostsWithAuthorQueryRtrn,
    {
      id: bigint;
      title: string | null;
      author: {
        id: bigint;
        username: string;
      };
    }[]
  >
>;

// Type test: fk relation with notNull FK column (Articles.authorId)
const articlesWithAuthorQuery = db.query(Articles).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    author: {
      columns: {
        id: true,
        username: true,
      },
    },
  },
});
type ArticlesWithAuthorQueryRtrn = Awaited<typeof articlesWithAuthorQuery>;
Expect<
  Equal<
    ArticlesWithAuthorQueryRtrn,
    {
      id: bigint;
      title: string;
      author: {
        id: bigint;
        username: string;
      };
    }[]
  >
>;

// Type test: fk relation with nullable FK column (Articles.categoryId) - result should be T | null
const articlesWithCategoryQuery = db.query(Articles).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    category: {
      columns: {
        id: true,
        name: true,
      },
    },
  },
});
type ArticlesWithCategoryQueryRtrn = Awaited<typeof articlesWithCategoryQuery>;
Expect<
  Equal<
    ArticlesWithCategoryQueryRtrn,
    {
      id: bigint;
      title: string;
      category: {
        id: number;
        name: string;
      } | null;
    }[]
  >
>;

// Type test: fk relation with both nullable and non-nullable FK columns
const articlesWithBothRelationsQuery = db.query(Articles).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    author: {
      columns: {
        id: true,
        username: true,
      },
    },
    category: {
      columns: {
        id: true,
        name: true,
      },
    },
  },
});
type ArticlesWithBothRelationsQueryRtrn = Awaited<
  typeof articlesWithBothRelationsQuery
>;
Expect<
  Equal<
    ArticlesWithBothRelationsQueryRtrn,
    {
      id: bigint;
      title: string;
      author: {
        id: bigint;
        username: string;
      };
      category: {
        id: number;
        name: string;
      } | null;
    }[]
  >
>;

// ============================================================================
// Nested `with` type tests
// ============================================================================

// Type test: 2-level nested with - Posts -> comments -> author
const postsWithNestedCommentsAuthorQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    comments: {
      columns: {
        id: true,
        body: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    },
  },
});
type PostsWithNestedCommentsAuthorQueryRtrn = Awaited<
  typeof postsWithNestedCommentsAuthorQuery
>;
Expect<
  Equal<
    PostsWithNestedCommentsAuthorQueryRtrn,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        body: string | null;
        author: {
          id: bigint;
          username: string;
        };
      }[];
    }[]
  >
>;

// Type test: 2-level nested with - Posts -> comments -> post (circular reference)
const postsWithNestedCommentsPostQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    comments: {
      columns: {
        id: true,
        body: true,
      },
      with: {
        post: {
          columns: {
            id: true,
            title: true,
          },
        },
      },
    },
  },
});
type PostsWithNestedCommentsPostQueryRtrn = Awaited<
  typeof postsWithNestedCommentsPostQuery
>;
Expect<
  Equal<
    PostsWithNestedCommentsPostQueryRtrn,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        body: string | null;
        post: {
          id: bigint;
          title: string | null;
        };
      }[];
    }[]
  >
>;

// Type test: Multiple nested branches - Posts with author AND comments with their authors
const postsWithAuthorAndNestedCommentsQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    author: {
      columns: {
        id: true,
        username: true,
      },
    },
    comments: {
      columns: {
        id: true,
        body: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    },
  },
});
type PostsWithAuthorAndNestedCommentsQueryRtrn = Awaited<
  typeof postsWithAuthorAndNestedCommentsQuery
>;
Expect<
  Equal<
    PostsWithAuthorAndNestedCommentsQueryRtrn,
    {
      id: bigint;
      title: string | null;
      author: {
        id: bigint;
        username: string;
      };
      comments: {
        id: bigint;
        body: string | null;
        author: {
          id: bigint;
          username: string;
        };
      }[];
    }[]
  >
>;

// Type test: 3-level nested with - Users -> posts -> comments -> author
const usersWithDeepNestedQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
  },
  with: {
    posts: {
      columns: {
        id: true,
        title: true,
      },
      with: {
        comments: {
          columns: {
            id: true,
            body: true,
          },
          with: {
            author: {
              columns: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    },
  },
});
type UsersWithDeepNestedQueryRtrn = Awaited<typeof usersWithDeepNestedQuery>;
Expect<
  Equal<
    UsersWithDeepNestedQueryRtrn,
    {
      id: bigint;
      username: string;
      posts: {
        id: bigint;
        title: string | null;
        comments: {
          id: bigint;
          body: string | null;
          author: {
            id: bigint;
            username: string;
          };
        }[];
      }[];
    }[]
  >
>;

// Type test: Nested with all columns (no column selection)
const postsWithNestedAllColumnsQuery = db.query(Posts).findMany({
  columns: {
    id: true,
    title: true,
  },
  with: {
    comments: {
      with: {
        author: {},
      },
    },
  },
});
type PostsWithNestedAllColumnsQueryRtrn = Awaited<
  typeof postsWithNestedAllColumnsQuery
>;
Expect<
  Equal<
    PostsWithNestedAllColumnsQueryRtrn,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        postId: bigint;
        userId: bigint;
        body: string | null;
        createdAt: Date;
        author: {
          id: bigint;
          username: string;
          email: string | null;
          type: "admin" | "user";
          createdAt: Date;
          externalId: string;
          trackingId: string | null;
        };
      }[];
    }[]
  >
>;

// ============================================================================
// findFirst type tests - verifies T | null return type (Object type shared with findMany)
// ============================================================================

// Type test: findFirst returns T | null (all columns)
const firstAllQr = db.query(Users).findFirst({});
type FirstAllQueryRtrn = Awaited<typeof firstAllQr>;
Expect<
  Equal<
    FirstAllQueryRtrn,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// Type test: findFirst with column selection returns subset T | null
const firstWtColsQr = db.query(Users).findFirst({
  columns: {
    id: true,
    username: true,
  },
});
type FirstWtColsRtrn = Awaited<typeof firstWtColsQr>;
Expect<
  Equal<
    FirstWtColsRtrn,
    {
      id: bigint;
      username: string;
    } | null
  >
>();

// Type test: findFirst with columns false returns excluded subset T | null
const firstWtColsFalseQr = db.query(Users).findFirst({
  columns: {
    id: false,
    createdAt: false,
  },
});
type FirstWtColsFalseRtrn = Awaited<typeof firstWtColsFalseQr>;
Expect<
  Equal<
    FirstWtColsFalseRtrn,
    {
      username: string;
      email: string | null;
      type: "admin" | "user";
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// Type test: findFirst with many relation (comments still array inside T | null)
const firstPostsWithCommentsQr = db.query(Posts).findFirst({
  columns: {
    id: true,
    title: true,
  },
  with: {
    comments: {
      columns: {
        id: true,
        body: true,
      },
    },
  },
});
type FirstPostsWithCommentsRtrn = Awaited<typeof firstPostsWithCommentsQr>;
Expect<
  Equal<
    FirstPostsWithCommentsRtrn,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        body: string | null;
      }[];
    } | null
  >
>();

// Type test: findFirst with fk relations (nullable and non-nullable)
const firstArticlesWithRelationsQr = db.query(Articles).findFirst({
  columns: {
    id: true,
    title: true,
  },
  with: {
    author: {
      columns: {
        id: true,
        username: true,
      },
    },
    category: {
      columns: {
        id: true,
        name: true,
      },
    },
  },
});
type FirstArticlesWithRelationsRtrn = Awaited<
  typeof firstArticlesWithRelationsQr
>;
Expect<
  Equal<
    FirstArticlesWithRelationsRtrn,
    {
      id: bigint;
      title: string;
      author: {
        id: bigint;
        username: string;
      };
      category: {
        id: number;
        name: string;
      } | null;
    } | null
  >
>();

// Type test: findFirst with nested with
const firstUsersDeepNestedQr = db.query(Users).findFirst({
  columns: {
    id: true,
    username: true,
  },
  with: {
    posts: {
      columns: {
        id: true,
        title: true,
      },
      with: {
        comments: {
          columns: {
            id: true,
            body: true,
          },
        },
      },
    },
  },
});
type FirstUsersDeepNestedRtrn = Awaited<typeof firstUsersDeepNestedQr>;
Expect<
  Equal<
    FirstUsersDeepNestedRtrn,
    {
      id: bigint;
      username: string;
      posts: {
        id: bigint;
        title: string | null;
        comments: {
          id: bigint;
          body: string | null;
        }[];
      }[];
    } | null
  >
>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - Non-existent column in columns should not compile
db.query(Users).findMany({ columns: { nonExistentColumn: true } });

// @ts-expect-error - Non-existent relation in with should not compile
db.query(Users).findMany({ with: { nonExistentRelation: {} } });

// @ts-expect-error - Wrong column type in where should not compile
db.query(Users).findMany({ where: eq(Users.id, "string_instead_of_number") });

// @ts-expect-error - Invalid enum value in where should not compile
db.query(Users).findMany({ where: eq(Users.type, "invalid_type") });

// @ts-expect-error - Column from wrong table in where should not compile
db.query(Users).findMany({ where: eq(Posts.userId, 1) });

db.query(Posts).findMany({
  // @ts-expect-error - Non-existent column in nested relation's columns should not compile
  with: { comments: { columns: { nonExistentColumn: true } } },
});

db.query(Posts).findMany({
  // @ts-expect-error - Non-existent relation in nested with should not compile
  with: { comments: { with: { nonExistentRelation: {} } } },
});

// @ts-expect-error -
db.query(Users).findMany({ orderBy: asc(Posts.createdAt) });

// @ts-expect-error - Non-existent column in findFirst should not compile
db.query(Users).findFirst({ columns: { nonExistentColumn: true } });

// @ts-expect-error - Non-existent relation in findFirst should not compile
db.query(Users).findFirst({ with: { nonExistentRelation: {} } });

// ============================================================================
// Negative type tests - where/orderBy/limit on nested Fk/One relations
// ============================================================================

db.query(Posts).findMany({
  with: {
    author: {
      // @ts-expect-error - where is not allowed on a nested Fk relation
      where: eq(Users.username, "foo"),
    },
  },
});

db.query(Users).findMany({
  with: {
    profile: {
      // @ts-expect-error - where is not allowed on a nested One relation
      where: eq(Users.username, "foo"),
    },
  },
});

db.query(Posts).findMany({
  with: {
    author: {
      // @ts-expect-error - orderBy is not allowed on a nested Fk relation
      orderBy: asc(Users.username),
    },
  },
});

db.query(Posts).findMany({
  with: {
    author: {
      // @ts-expect-error - limit is not allowed on a nested Fk relation
      limit: 10,
    },
  },
});

// Positive: where IS allowed on a nested Many relation (comments)
db.query(Posts).findMany({
  with: { comments: { where: eq(Comments.body, "hello") } },
});
