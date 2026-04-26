import { enumtype, Migrations, notNull, pk, table, varchar } from "durcno";

export { Migrations };

export const StatusEnum = enumtype("public", "status", ["active", "inactive"]);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 100, notNull }),
  email: varchar({ length: 255, notNull }),
  status: StatusEnum.enumed({ notNull }),
});
