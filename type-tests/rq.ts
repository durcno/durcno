import { asc, desc, eq } from "durcno";
import { Articles, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Section 1: Basic findMany & Column Selection
// ============================================================================

// Select all columns
const _findManyAllQuery = db.query(Users).findMany({});
type FindManyAll = Awaited<typeof _findManyAllQuery>;
Expect<
  Equal<
    FindManyAll,
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

// Select specific columns with true map
const _findManyTrueMapQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    email: true,
    type: true,
  },
});
type FindManyTrueMap = Awaited<typeof _findManyTrueMapQuery>;
Expect<
  Equal<
    FindManyTrueMap,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>();

// Exclude specific columns with false map
const _findManyFalseMapQuery = db.query(Users).findMany({
  columns: {
    id: false,
    createdAt: false,
  },
});
type FindManyFalseMap = Awaited<typeof _findManyFalseMapQuery>;
Expect<
  Equal<
    FindManyFalseMap,
    {
      username: string;
      email: string | null;
      type: "admin" | "user";
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// ============================================================================
// Section 2: findMany Filtering & Ordering (where, orderBy)
// ============================================================================

// Query with where clause condition
const _findManyWhereQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    email: true,
    type: true,
  },
  where: eq(Users.type, "user"),
});
type FindManyWhere = Awaited<typeof _findManyWhereQuery>;
Expect<
  Equal<
    FindManyWhere,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>();

// Query with single column orderBy
const _findManyOrderByQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
  },
  orderBy: asc(Users.username),
});
type FindManyOrderBy = Awaited<typeof _findManyOrderByQuery>;
Expect<
  Equal<
    FindManyOrderBy,
    {
      id: bigint;
      username: string;
    }[]
  >
>();

// Query with multi-column array orderBy
const _findManyMultiOrderByQuery = db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
    createdAt: true,
  },
  orderBy: [asc(Users.username), desc(Users.createdAt)],
});
type FindManyMultiOrderBy = Awaited<typeof _findManyMultiOrderByQuery>;
Expect<
  Equal<
    FindManyMultiOrderBy,
    {
      id: bigint;
      username: string;
      createdAt: Date;
    }[]
  >
>();

// ============================================================================
// Section 3: findMany Relational with Queries (1-Level Relations)
// ============================================================================

// One-to-one relation (profile on Users -> profile object or null)
const _usersWithProfileQuery = db.query(Users).findMany({
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
type UsersWithProfile = Awaited<typeof _usersWithProfileQuery>;
Expect<
  Equal<
    UsersWithProfile,
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
>();

// One-to-many relation (comments on Posts -> comments array)
const _postsWithCommentsQuery = db.query(Posts).findMany({
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
type PostsWithComments = Awaited<typeof _postsWithCommentsQuery>;
Expect<
  Equal<
    PostsWithComments,
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
>();

// FK relation with notNull FK column (author on Articles -> non-nullable author)
const _articlesWithAuthorQuery = db.query(Articles).findMany({
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
type ArticlesWithAuthor = Awaited<typeof _articlesWithAuthorQuery>;
Expect<
  Equal<
    ArticlesWithAuthor,
    {
      id: bigint;
      title: string;
      author: {
        id: bigint;
        username: string;
      };
    }[]
  >
>();

// FK relation with nullable FK column (category on Articles -> category or null)
const _articlesWithCategoryQuery = db.query(Articles).findMany({
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
type ArticlesWithCategory = Awaited<typeof _articlesWithCategoryQuery>;
Expect<
  Equal<
    ArticlesWithCategory,
    {
      id: bigint;
      title: string;
      category: {
        id: number;
        name: string;
      } | null;
    }[]
  >
>();

// FK relation with both nullable and non-nullable FK columns
const _articlesWithBothRelationsQuery = db.query(Articles).findMany({
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
type ArticlesWithBothRelations = Awaited<
  typeof _articlesWithBothRelationsQuery
>;
Expect<
  Equal<
    ArticlesWithBothRelations,
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
>();

// ============================================================================
// Section 4: findMany Nested Relational with Queries (Multi-Level Relations)
// ============================================================================

// 2-level nested with (Posts -> comments -> author)
const _postsWithNestedCommentsAuthorQuery = db.query(Posts).findMany({
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
type PostsWithNestedCommentsAuthor = Awaited<
  typeof _postsWithNestedCommentsAuthorQuery
>;
Expect<
  Equal<
    PostsWithNestedCommentsAuthor,
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
>();

// 2-level circular reference with (Posts -> comments -> post)
const _postsWithNestedCommentsPostQuery = db.query(Posts).findMany({
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
type PostsWithNestedCommentsPost = Awaited<
  typeof _postsWithNestedCommentsPostQuery
>;
Expect<
  Equal<
    PostsWithNestedCommentsPost,
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
>();

// Multiple nested branches (Posts -> author AND comments -> author)
const _postsWithAuthorAndNestedCommentsQuery = db.query(Posts).findMany({
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
type PostsWithAuthorAndNestedComments = Awaited<
  typeof _postsWithAuthorAndNestedCommentsQuery
>;
Expect<
  Equal<
    PostsWithAuthorAndNestedComments,
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
>();

// 3-level deep nested with (Users -> posts -> comments -> author)
const _usersWithDeepNestedQuery = db.query(Users).findMany({
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
type UsersWithDeepNested = Awaited<typeof _usersWithDeepNestedQuery>;
Expect<
  Equal<
    UsersWithDeepNested,
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
>();

// Nested with selecting all columns (empty object for nested author)
const _postsWithNestedAllColumnsQuery = db.query(Posts).findMany({
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
type PostsWithNestedAllColumns = Awaited<
  typeof _postsWithNestedAllColumnsQuery
>;
Expect<
  Equal<
    PostsWithNestedAllColumns,
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
>();

// ============================================================================
// Section 5: findFirst Query Return Types
// ============================================================================

// findFirst returns T | null (all columns)
const _firstAllQuery = db.query(Users).findFirst({});
type FirstAll = Awaited<typeof _firstAllQuery>;
Expect<
  Equal<
    FirstAll,
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

// findFirst with column selection returns subset T | null
const _firstTrueMapQuery = db.query(Users).findFirst({
  columns: {
    id: true,
    username: true,
  },
});
type FirstTrueMap = Awaited<typeof _firstTrueMapQuery>;
Expect<
  Equal<
    FirstTrueMap,
    {
      id: bigint;
      username: string;
    } | null
  >
>();

// findFirst with false map returns excluded subset T | null
const _firstFalseMapQuery = db.query(Users).findFirst({
  columns: {
    id: false,
    createdAt: false,
  },
});
type FirstFalseMap = Awaited<typeof _firstFalseMapQuery>;
Expect<
  Equal<
    FirstFalseMap,
    {
      username: string;
      email: string | null;
      type: "admin" | "user";
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// findFirst with one-to-many relation
const _firstPostsWithCommentsQuery = db.query(Posts).findFirst({
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
type FirstPostsWithComments = Awaited<typeof _firstPostsWithCommentsQuery>;
Expect<
  Equal<
    FirstPostsWithComments,
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

// findFirst with FK relations (nullable and non-nullable)
const _firstArticlesWithRelationsQuery = db.query(Articles).findFirst({
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
type FirstArticlesWithRelations = Awaited<
  typeof _firstArticlesWithRelationsQuery
>;
Expect<
  Equal<
    FirstArticlesWithRelations,
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

// findFirst with multi-level nested with
const _firstPostsDeepNestedQuery = db.query(Posts).findFirst({
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
type FirstPostsDeepNested = Awaited<typeof _firstPostsDeepNestedQuery>;
Expect<
  Equal<
    FirstPostsDeepNested,
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
    } | null
  >
>();

// ============================================================================
// Section 6: Negative Type Safety Tests
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

// @ts-expect-error - Column from wrong table in orderBy should not compile
db.query(Users).findMany({ orderBy: asc(Posts.createdAt) });

// @ts-expect-error - Non-existent column in findFirst should not compile
db.query(Users).findFirst({ columns: { nonExistentColumn: true } });

// @ts-expect-error - Non-existent relation in findFirst should not compile
db.query(Users).findFirst({ with: { nonExistentRelation: {} } });

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
