import CodeMirror from "@uiw/react-codemirror";
import { keymap, EditorView } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { useMemo } from "react";

export type AnswerLanguage = "plain" | "javascript" | "typescript" | "python" | "sql" | "java" | "cpp" | "go" | "rust" | "json" | "html" | "css";
export const ANSWER_LANGUAGES: { id: AnswerLanguage; name: string }[] = [
  { id: "plain", name: "Текст" }, { id: "javascript", name: "JavaScript" }, { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" }, { id: "sql", name: "SQL" }, { id: "java", name: "Java" },
  { id: "cpp", name: "C++" }, { id: "go", name: "Go" }, { id: "rust", name: "Rust" }, { id: "json", name: "JSON" }, { id: "html", name: "HTML" }, { id: "css", name: "CSS" },
];
const syntax = {
  plain: () => [], javascript: () => [javascript()], typescript: () => [javascript({ typescript: true })],
  python: () => [python()], sql: () => [sql()], java: () => [java()], cpp: () => [cpp()], go: () => [go()], rust: () => [rust()], json: () => [json()], html: () => [html()], css: () => [css()],
};
const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", color: "inherit", fontSize: "13px" },
  ".cm-content": { minHeight: "260px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", padding: "10px" },
  ".cm-gutters": { backgroundColor: "transparent", borderRight: "1px solid #46506455" },
  "&.cm-focused": { outline: "2px solid #8b5cf6", outlineOffset: "-2px" },
});
export function PracticeCodeEditor({ value, language, onChange }: { value: string; language: AnswerLanguage; onChange: (value: string) => void }) {
  const extensions = useMemo(() => [...syntax[language](), keymap.of([indentWithTab]), EditorView.lineWrapping, theme], [language]);
  return <div role="group" aria-label="Редактор ответа" className="overflow-hidden rounded-lg border border-ink-600 bg-ink-850 text-mist-100">
    <CodeMirror value={value} onChange={onChange} extensions={extensions} basicSetup={{ lineNumbers: true, foldGutter: true }} aria-label="Ваш ответ" />
  </div>;
}
