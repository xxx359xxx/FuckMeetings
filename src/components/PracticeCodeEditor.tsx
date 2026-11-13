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
import { useSettings } from "../lib/settings";

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
function editorTheme(dark: boolean) { return EditorView.theme({
  "&": { backgroundColor: "var(--color-ink-850)", color: "var(--color-mist-100)", fontSize: "13px" },
  ".cm-content": { minHeight: "260px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", padding: "10px", caretColor: "var(--color-mist-100)" },
  ".cm-gutters": { backgroundColor: "var(--color-ink-850)", color: "var(--color-mist-400)", borderRight: "1px solid var(--color-ink-600)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: dark ? "#ffffff0b" : "#21195f0b" },
  "&.cm-focused": { outline: "2px solid var(--color-accent-500)", outlineOffset: "-2px" },
}, { dark }); }
export function PracticeCodeEditor({ value, language, onChange }: { value: string; language: AnswerLanguage; onChange: (value: string) => void }) {
  const dark = useSettings(state => state.settings.theme === "dark");
  const extensions = useMemo(() => [...syntax[language](), keymap.of([indentWithTab]), EditorView.lineWrapping, editorTheme(dark)], [language, dark]);
  return <div role="group" aria-label="Редактор ответа" className="overflow-hidden rounded-lg border border-ink-600 bg-ink-850 text-mist-100">
    <CodeMirror theme={dark ? "dark" : "light"} value={value} onChange={onChange} extensions={extensions} basicSetup={{ lineNumbers: true, foldGutter: true }} aria-label="Ваш ответ" />
  </div>;
}
