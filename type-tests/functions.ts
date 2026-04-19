import type { now, Sql, uuidv4, uuidv7 } from "durcno";
import { type Equal, Expect } from "./utils";

// now(), uuidv4(), uuidv7() return Sql
Expect<Equal<ReturnType<typeof now>, Sql>>();
Expect<Equal<ReturnType<typeof uuidv4>, Sql>>();
Expect<Equal<ReturnType<typeof uuidv7>, Sql>>();
