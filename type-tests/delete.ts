import { and, eq, gte, isIn, isNotNull, isNull, lte, or } from "durcno";
import { db, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Section 1: Basic Delete & Return Types
// ============================================================================

// Basic delete without where returns null
const _basicDeleteQuery = db.deleteFrom(Users);
type BasicDelete = Awaited<typeof _basicDeleteQuery>;
Expect<Equal<BasicDelete, null>>();

// Delete with simple where condition returns null
const _deleteWithWhereQuery = db.deleteFrom(Users).where(eq(Users.id, 1n));
type DeleteWithWhere = Awaited<typeof _deleteWithWhereQuery>;
Expect<Equal<DeleteWithWhere, null>>();

// ============================================================================
// Section 2: Where Clause Filtering & Filter Operators
// ============================================================================

// Logical combination with and / or
const _deleteWithAndQuery = db
  .deleteFrom(Users)
  .where(and(eq(Users.id, 1n), eq(Users.type, "admin")));
type DeleteWithAnd = Awaited<typeof _deleteWithAndQuery>;
Expect<Equal<DeleteWithAnd, null>>();

const _deleteWithOrQuery = db
  .deleteFrom(Users)
  .where(or(eq(Users.type, "admin"), eq(Users.type, "user")));
type DeleteWithOr = Awaited<typeof _deleteWithOrQuery>;
Expect<Equal<DeleteWithOr, null>>();

// Comparison operators (gte, lte)
const _deleteWithGteQuery = db.deleteFrom(Users).where(gte(Users.id, 10n));
type DeleteWithGte = Awaited<typeof _deleteWithGteQuery>;
Expect<Equal<DeleteWithGte, null>>();

const _deleteWithLteQuery = db.deleteFrom(Users).where(lte(Users.id, 100n));
type DeleteWithLte = Awaited<typeof _deleteWithLteQuery>;
Expect<Equal<DeleteWithLte, null>>();

// Nullability checks (isNull, isNotNull)
const _deleteWithIsNullQuery = db.deleteFrom(Users).where(isNull(Users.email));
type DeleteWithIsNull = Awaited<typeof _deleteWithIsNullQuery>;
Expect<Equal<DeleteWithIsNull, null>>();

const _deleteWithIsNotNullQuery = db
  .deleteFrom(Users)
  .where(isNotNull(Users.email));
type DeleteWithIsNotNull = Awaited<typeof _deleteWithIsNotNullQuery>;
Expect<Equal<DeleteWithIsNotNull, null>>();

// Array membership check (isIn)
const _deleteWithIsInQuery = db
  .deleteFrom(Users)
  .where(isIn(Users.type, ["admin", "user"]));
type DeleteWithIsIn = Awaited<typeof _deleteWithIsInQuery>;
Expect<Equal<DeleteWithIsIn, null>>();

// ============================================================================
// Section 3: Returning Clause Selection
// ============================================================================

// Specific column returning selection
const _deleteReturningSpecificQuery = db
  .deleteFrom(Users)
  .where(eq(Users.type, "admin"))
  .returning({ id: true, username: true });
type DeleteReturningSpecific = Awaited<typeof _deleteReturningSpecificQuery>;
Expect<Equal<DeleteReturningSpecific, { id: bigint; username: string }[]>>();

// False-map returning ({ column: false }) excludes specified column
const _deleteReturningFalseMapQuery = db
  .deleteFrom(Users)
  .where(eq(Users.id, 1n))
  .returning({ email: false });
type DeleteReturningFalseMap = Awaited<typeof _deleteReturningFalseMapQuery>;
Expect<
  Equal<
    DeleteReturningFalseMap,
    {
      id: bigint;
      username: string;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Single column returning
const _deleteReturningSingleQuery = db
  .deleteFrom(Users)
  .returning({ email: true });
type DeleteReturningSingle = Awaited<typeof _deleteReturningSingleQuery>;
Expect<Equal<DeleteReturningSingle, { email: string | null }[]>>();

// Chaining order (returning before where)
const _deleteReturningBeforeWhereQuery = db
  .deleteFrom(Users)
  .returning({ id: true, username: true })
  .where(eq(Users.id, 1n));
type DeleteReturningBeforeWhere = Awaited<
  typeof _deleteReturningBeforeWhereQuery
>;
Expect<Equal<DeleteReturningBeforeWhere, { id: bigint; username: string }[]>>();

// Wildcard returning ("*")
const _deleteReturningWildcardQuery = db
  .deleteFrom(Users)
  .where(eq(Users.id, 1n))
  .returning("*");
type DeleteReturningWildcard = Awaited<typeof _deleteReturningWildcardQuery>;
Expect<
  Equal<
    DeleteReturningWildcard,
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

// ============================================================================
// Section 4: Negative Type Safety Tests
// ============================================================================

// @ts-expect-error - Wrong type for comparison should not compile
db.deleteFrom(Users).where(eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - Invalid enum value should not compile
db.deleteFrom(Users).where(eq(Users.type, "invalid_type"));

// @ts-expect-error - Wrong field reference should not compile
db.deleteFrom(Users).where(eq(Users.nonExistentField, "value"));

// @ts-expect-error - Comparing incompatible column and value types should not compile
db.deleteFrom(Users).where(eq(Users.username, 123));

db.deleteFrom(Users)
  .where(eq(Users.id, 1n))
  // @ts-expect-error - Returning non-existent column should not compile
  .returning({ nonExistentColumn: true });

// Negative test: db.delete does not exist; use db.deleteFrom
// @ts-expect-error - Property 'delete' does not exist on db; use deleteFrom
db.delete(Users);
