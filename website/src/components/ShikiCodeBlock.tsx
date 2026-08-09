import clsx from "clsx";
import { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import styles from "./ShikiCodeBlock.module.css";

let highlighterPromise: Promise<Highlighter> | null = null;

export default function ShikiCodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language: string;
  className?: string;
}) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    if (!highlighterPromise) {
      highlighterPromise = createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: ["typescript", "javascript", "json", "bash", "sql"],
      });
    }

    highlighterPromise.then((highlighter) => {
      const out = highlighter.codeToHtml(code, {
        lang: language,
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      });
      setHtml(out);
    });
  }, [code, language]);

  if (!html) {
    return (
      <div className={clsx(styles.shikiContainer, className)}>
        <pre className="shiki">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className={clsx(styles.shikiContainer, className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <>
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
