import { database, eq, integer, pk, table, varchar } from "durcno";
import { type Equal, Expect, testSetup } from "./utils";

// Setup test schema
const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50 }),
  email: varchar({ length: 100 }),
});

const Posts = table("public", "posts", {
  id: pk(),
  userId: integer({ notNull: true }),
  title: varchar({ length: 200 }),
  content: varchar({ length: 1000 }),
});

const db = database({ Users, Posts }, testSetup);

// Test transaction method exists and has correct types
type TransactionMethod = typeof db.transaction;
type HasTransaction = TransactionMethod extends undefined ? false : true;
Expect<Equal<HasTransaction, true>>();

// Test transaction callback parameter types exist
type TransactionTest = Parameters<TransactionMethod>[0];

// Test that transaction context has all expected methods
type TransactionContext = Parameters<TransactionTest>[0];
type HasInsert = "insert" extends keyof TransactionContext ? true : false;
type HasFrom = "from" extends keyof TransactionContext ? true : false;
type HasUpdate = "update" extends keyof TransactionContext ? true : false;
type HasDelete = "delete" extends keyof TransactionContext ? true : false;

Expect<Equal<HasInsert, true>>();
Expect<Equal<HasFrom, true>>();
Expect<Equal<HasUpdate, true>>();
Expect<Equal<HasDelete, true>>();

// Test basic transaction structure - transaction exists and is callable
const _testTransactionExists = db.transaction;

// Test that we can call transaction with a callback
const _testTransactionPromise = db.transaction(async (tx) => {
  // Test that transaction context has the expected methods
  const _insertBuilder = tx.insert(Users);
  const _selectBuilder = tx.from(Users);
  const _updateBuilder = tx.update(Users);
  const _deleteBuilder = tx.delete(Users);

  // Test basic query execution pattern
  await tx.insert(Users).values({
    username: "test",
    email: "test@example.com",
  });

  const users = await tx.from(Users).select();
  return users;
});

// Test that transaction returns a Promise
type TransactionReturnType = typeof _testTransactionPromise;
Expect<
  Equal<TransactionReturnType extends Promise<unknown> ? true : false, true>
>();

type TransactionAwaitType = Awaited<typeof _testTransactionPromise>;
Expect<
  Equal<
    TransactionAwaitType,
    {
      id: bigint;
      username: string | null;
      email: string | null;
    }[]
  >
>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

db.transaction(async (tx) => {
  // @ts-expect-error - Accessing non-existent table in transaction should not compile
  await tx.from(NonExistentTable).select();
});

db.transaction(async (tx) => {
  // @ts-expect-error - Wrong type for insert value in transaction should not compile
  await tx.insert(Users).values({ username: 123, email: "test@example.com" });
});

db.transaction(async (tx) => {
  // @ts-expect-error - Insert to wrong column in transaction should not compile
  await tx.insert(Users).values({ postId: 1, username: "test" });
});

db.transaction(async (tx) => {
  // @ts-expect-error - Wrong type in update set in transaction should not compile
  await tx.update(Users).set({ username: 123 });
});

db.transaction(async (tx) => {
  // @ts-expect-error - Wrong type in delete where in transaction should not compile
  await tx.delete(Users).where(eq(Users.id, "not_a_number"));
});
