import { table, varchar } from "durcno";

export const ExecItems = table("public", "exec_items", {
  name: varchar({ length: 100 }),
});
