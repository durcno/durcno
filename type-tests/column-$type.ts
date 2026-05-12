import { ArrayTest, Events, Posts } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: Numeric column with $type override (Events.capacity)
Expect<Equal<(typeof Events.capacity)["ValType"], { seats: number }>>();

// Type test: JSON column with $type override to typed object (Events.eventMetadata)
Expect<Equal<(typeof Events.eventMetadata)["ValType"], { tags: string[] }>>();

// Type test: JSON column with $type override to typed object (Posts.metrics)
Expect<
  Equal<(typeof Posts.metrics)["ValType"], { views: number; likes: number }>
>();

// Type test: Integer column with $type override to enum union (ArrayTest.priority)
Expect<
  Equal<(typeof ArrayTest.priority)["ValType"], "high" | "medium" | "low">
>();
