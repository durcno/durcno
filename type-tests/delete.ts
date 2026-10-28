import { and, eq, gte, isIn, isNull, lte, or } from "durcno";
import { db, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// -----------------------------------------------------------------------------
// Basic delete
// -----------------------------------------------------------------------------

// A delete without `.returning()` resolves to null
const _basicDeleteQuery = db.deleteFrom(Users).where(eq(Users.id, 1n));
type BasicDelete = Awaited<typeof _basicDeleteQuery>;
Expect<Equal<BasicDelete, null>>();

// @ts-expect-error - db.delete does not exist; use deleteFrom
db.delete(Users);

// -----------------------------------------------------------------------------
// Filtering
// -----------------------------------------------------------------------------

// Every filter shape flows through the delete where clause unchanged
const _filteredDeleteQuery = db
  .deleteFrom(Users)
  .where(
    and(
      eq(Users.type, "admin"),
      or(gte(Users.id, 10n), lte(Users.id, 100n)),
      isNull(Users.email),
      isIn(Users.id, [1n, 2n, 3n]),
    ),
  );
Expect<Equal<Awaited<typeof _filteredDeleteQuery>, null>>();

// @ts-expect-error - wrong type for a bigint column
db.deleteFrom(Users).where(eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - invalid enum value
db.deleteFrom(Users).where(eq(Users.type, "invalid_type"));

// @ts-expect-error - non-existent column
db.deleteFrom(Users).where(eq(Users.nonExistentField, "value"));

// -----------------------------------------------------------------------------
// Returning
// -----------------------------------------------------------------------------

// A minimal selection proves `.returning()` is wired to the delete builder
const _deleteReturningQuery = db
  .deleteFrom(Users)
  .where(eq(Users.type, "admin"))
  .returning({ id: true, username: true });
type DeleteReturning = Awaited<typeof _deleteReturningQuery>;
Expect<Equal<DeleteReturning, { id: bigint; username: string }[]>>();

db.deleteFrom(Users)
  .where(eq(Users.id, 1n))
  // @ts-expect-error - returning a non-existent column
  .returning({ nonExistentColumn: true });
