import type { Options } from "..";
import { generate } from "./generate";
import { migrate } from "./migrate";

export async function push(options: Options): Promise<void> {
  await generate(options);
  await migrate(options);
}
