export type SqlPart =
  | { type: "sql"; sql: string }
  | { type: "meta"; command: string };

/**
 * Splits a SQL script into executable statements.
 *
 * Semicolons inside strings, quoted identifiers, dollar-quoted bodies, and
 * comments do not terminate a statement. A script made only of meta commands
 * (one per line) is returned as meta parts.
 */
export function splitSqlScript(input: string): SqlPart[] {
  const meta = parseMetaScript(input);
  if (meta) return meta;

  const parts: SqlPart[] = [];
  let buffer = "";
  let hasContent = false;
  let i = 0;

  const pushStatement = () => {
    if (hasContent) {
      const sql = buffer.trim();
      if (sql.length > 0) parts.push({ type: "sql", sql });
    }
    buffer = "";
    hasContent = false;
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === "-" && input[i + 1] === "-") {
      const end = input.indexOf("\n", i);
      if (end === -1) {
        buffer += input.slice(i);
        i = input.length;
      } else {
        buffer += input.slice(i, end + 1);
        i = end + 1;
      }
      continue;
    }

    if (ch === "/" && input[i + 1] === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < input.length && depth > 0) {
        if (input[j] === "/" && input[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (input[j] === "*" && input[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      buffer += input.slice(i, j);
      i = j;
      continue;
    }

    if (ch === "'") {
      hasContent = true;
      const escapeString = isEscapeString(input, i);
      let j = i + 1;
      while (j < input.length) {
        if (escapeString && input[j] === "\\") {
          j += 2;
          continue;
        }
        if (input[j] === "'") {
          if (input[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      buffer += input.slice(i, j);
      i = j;
      continue;
    }

    if (ch === '"') {
      hasContent = true;
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === '"') {
          if (input[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      buffer += input.slice(i, j);
      i = j;
      continue;
    }

    if (ch === "$") {
      const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(input.slice(i));
      if (match) {
        hasContent = true;
        const tag = match[0];
        const end = input.indexOf(tag, i + tag.length);
        const stop = end === -1 ? input.length : end + tag.length;
        buffer += input.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (ch === ";") {
      pushStatement();
      i++;
      continue;
    }

    buffer += ch;
    if (ch !== " " && ch !== "\n" && ch !== "\r" && ch !== "\t") {
      hasContent = true;
    }
    i++;
  }

  pushStatement();
  return parts;
}

function isEscapeString(input: string, quoteIndex: number): boolean {
  const prefix = input[quoteIndex - 1];
  if (prefix !== "E" && prefix !== "e") return false;
  const before = input[quoteIndex - 2];
  return before === undefined || !/[A-Za-z0-9_$]/.test(before);
}

function parseMetaScript(input: string): SqlPart[] | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("\\")) return null;

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || !lines.every((line) => line.startsWith("\\"))) {
    return null;
  }

  return lines.map((command) => ({ type: "meta", command }));
}
