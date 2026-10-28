import type { ArrayTest, Events, Posts } from "./schema";
import { type Equal, Expect } from "./utils";

// Numeric column with $type override (Events.capacity)
Expect<Equal<(typeof Events.capacity)["ValType"], { seats: number }>>();

// JSON column with $type override to typed object (Events.eventMetadata)
Expect<Equal<(typeof Events.eventMetadata)["ValType"], { tags: string[] }>>();

// JSON column with $type override to typed object (Posts.metrics)
Expect<
  Equal<(typeof Posts.metrics)["ValType"], { views: number; likes: number }>
>();

// Integer column with $type override to enum union (ArrayTest.priority)
Expect<
  Equal<(typeof ArrayTest.priority)["ValType"], "high" | "medium" | "low">
>();
