import { eq } from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// -----------------------------------------------------------------------------
// Scalar shortcuts
// -----------------------------------------------------------------------------

// $count / $exists
const _countQuery = db.$count(Users, eq(Users.type, "admin"));
Expect<Equal<Awaited<typeof _countQuery>, number>>();

const _existsQuery = db.$exists(Users, eq(Users.type, "admin"));
Expect<Equal<Awaited<typeof _existsQuery>, boolean>>();

// $first returns the full row or null
const _firstUser = db.$first(Users);
Expect<
  Equal<
    Awaited<typeof _firstUser>,
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

// Aggregates resolve to number | null
const _sumQuery = db.$sum(Posts, Posts.id);
Expect<Equal<Awaited<typeof _sumQuery>, number | null>>();

const _avgQuery = db.$avg(Posts, Posts.userId);
Expect<Equal<Awaited<typeof _avgQuery>, number | null>>();

const _minQuery = db.$min(Posts, Posts.userId);
Expect<Equal<Awaited<typeof _minQuery>, number | null>>();

const _maxQuery = db.$max(Posts, Posts.userId);
Expect<Equal<Awaited<typeof _maxQuery>, number | null>>();

// $distinct maps the column type, including nullability
const _distinctNullable = db.$distinct(Users, Users.email);
Expect<Equal<Awaited<typeof _distinctNullable>, (string | null)[]>>();

const _distinctEnum = db.$distinct(Users, Users.type);
Expect<Equal<Awaited<typeof _distinctEnum>, ("admin" | "user")[]>>();

const _distinctNumeric = db.$distinct(Posts, Posts.userId);
Expect<Equal<Awaited<typeof _distinctNumeric>, bigint[]>>();

// @ts-expect-error - filter values are type-checked
db.$exists(Users, eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - $distinct takes a column of the same table
db.$distinct(Users, Posts.title);
