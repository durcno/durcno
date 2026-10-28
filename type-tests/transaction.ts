import { database, eq, integer, notNull, pk, table, varchar } from "durcno";
import { type Equal, Expect, testSetup } from "./utils";

const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50 }),
  email: varchar({ length: 100 }),
});

const Posts = table("public", "posts", {
  id: pk(),
  userId: integer({ notNull }),
  title: varchar({ length: 200 }),
  content: varchar({ length: 1000 }),
});

const db = database({ Users, Posts }, testSetup);

// The transaction context exposes every builder
type TransactionContext = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TransactionMethods = "insertInto" | "from" | "update" | "deleteFrom";
Expect<
  Equal<
    TransactionMethods extends keyof TransactionContext ? true : false,
    true
  >
>();

const transactionResult = db.transaction(async (tx) => {
  await tx.insertInto(Users).values({
    username: "test",
    email: "test@example.com",
  });

  return tx.from(Users).select("*");
});

Expect<
  Equal<
    Awaited<typeof transactionResult>,
    { id: bigint; username: string | null; email: string | null }[]
  >
>();

db.transaction(async (tx) => {
  // @ts-expect-error - unknown table in the transaction context
  await tx.from(NonExistentTable).select("*");
});

db.transaction(async (tx) => {
  // @ts-expect-error - wrong value type in a transaction insert
  await tx.insert(Users).values({ username: 123, email: "test@example.com" });
});

db.transaction(async (tx) => {
  // @ts-expect-error - wrong value type in a transaction update
  await tx.update(Users).set({ username: 123 });
});

db.transaction(async (tx) => {
  // @ts-expect-error - wrong value type in a transaction delete
  await tx.delete(Users).where(eq(Users.id, "not_a_number"));
});
