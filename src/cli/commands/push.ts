import { type GenerateOptions, generate } from "./generate";
import { migrate } from "./migrate";

export async function push(options: GenerateOptions): Promise<void> {
  await generate(options);
  await migrate(options);
}
