import { avg, count, countDistinct, max, min, sum } from "durcno";
import { ArrayTest, Posts, Users } from "./schema";

// Positive tests for avg and sum
avg(Posts.id);
avg(Posts.userId);
sum(Posts.id);
sum(Posts.userId);

// Negative tests for avg and sum with string columns
// @ts-expect-error
avg(Users.username);
// @ts-expect-error
sum(Users.username);

// Negative tests for avg and sum with boolean columns
// @ts-expect-error
avg(Users.isActive); // Assuming isActive exists, or use enum column
// @ts-expect-error
sum(Users.type);

// Negative tests for avg and sum with numeric array columns
// @ts-expect-error
avg(ArrayTest.coordinates);
// @ts-expect-error
sum(ArrayTest.coordinates);

// min and max should accept any column
min(Users.username);
max(Users.username);
min(Posts.createdAt);
max(Posts.createdAt);
min(Posts.id);
max(Posts.id);

// count should accept any column
count(Users.username);
count("*");
countDistinct(Users.username);
