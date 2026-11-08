import { tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button, Card } from "../components/ui";
import { DEFAULT_SHORTCUTS, IS_MAC, SHORTCUT_ACTIONS, SHORTCUT_LABELS, finishShortcutCapture, hotkeyLabel, pauseShortcutCapture, useHotkey } from "../lib/overlay";
import { saveSettings, useSettings } from "../lib/settings";
import type { ShortcutAction } from "../lib/types";

function keyFromEvent(e: KeyboardEvent): string | null {
  if (!(e.ctrlKey || e.altKey || e.metaKey)) return null;
  let key = "";
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-2])$/.test(e.code)) key = e.code;
  else key = ({ ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Space: "Space", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert" } as Record<string, string>)[e.code] || "";
  if (!key) return null;
  return [e.ctrlKey && "Control", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Super", key].filter(Boolean).join("+");
}
export function ShortcutsPage() {
  const shortcuts = useSettings((s) => s.settings.shortcuts);
  const patch = useSettings((s) => s.patch);
  const errors = useHotkey((s) => s.errors);
  const [capture, setCapture] = useState<ShortcutAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const captureRef = useRef<ShortcutAction | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (captureRef.current) { captureRef.current = null; void finishShortcutCapture(); } }; }, []);
  async function start(action: ShortcutAction) {
    setMessage(""); setBusy(true);
    try { await pauseShortcutCapture(); if (!mounted.current) { await finishShortcutCapture(); return; } captureRef.current = action; setCapture(action); }
    catch (e) { setMessage(`Не удалось начать запись: ${String(e)}`); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function finish(action: ShortcutAction, key?: string) {
    if (captureRef.current !== action) return;
    captureRef.current = null; setCapture(null); setBusy(true);
    try {
      const result = await finishShortcutCapture(key ? action : undefined, key);
      if (!mounted.current) return;
      if (!result.ok) setMessage(result.error || "Не удалось назначить сочетание.");
      else if (key) { patch({ shortcuts: { ...useSettings.getState().settings.shortcuts, [action]: key } }); await saveSettings(); setMessage("Сочетание сохранено и применено."); }
      else setMessage("Изменение отменено.");
    } catch (e) { if (mounted.current) setMessage(`Не удалось сохранить сочетание: ${String(e)}`); }
    finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => {
    if (!capture) return;
    const listener = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat) return;
      if (e.key === "Escape") { void finish(capture); return; }
      const key = keyFromEvent(e); if (key) void finish(capture, key);
      else if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) setMessage(IS_MAC ? "Используйте Cmd, Ctrl или Option вместе с другой клавишей." : "Используйте Ctrl, Alt или Win вместе с другой клавишей.");
    };
    window.addEventListener("keydown", listener, true); return () => window.removeEventListener("keydown", listener, true);
  }, [capture]);
  return <div className="h-full overflow-y-auto"><div className="mx-auto max-w-3xl space-y-5 p-6">
    
    <header><h1 className="flex items-center gap-2 text-xl font-semibold"><Keyboard size={20} /> {tr("Горячие клавиши")}</h1><p className="mt-1 text-sm text-mist-400">{tr("Нажмите «Изменить», затем одновременно нажмите нужные клавиши. Escape отменяет запись.")}</p></header>
    
    {message && <p role="status" className="rounded-lg border border-ink-700 bg-ink-850 p-3 text-sm text-mist-200">{tr(message)}</p>}
    
    <Card><div className="space-y-1">{SHORTCUT_ACTIONS.map((action) => <div key={action} className="flex flex-wrap items-center gap-3 border-b border-ink-700/70 py-3 last:border-0">
      
      {(action === "show" || action === "screen" || action === "up") && <h2 className="w-full pt-2 text-sm font-semibold text-accent-400">{action === "show" ? tr("Управление помощником") : action === "screen" ? tr("Снимки экрана") : tr("Перемещение окна")}</h2>}
      
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{tr(SHORTCUT_LABELS[action])}</div>{errors[action] && <div className="mt-1 text-xs text-red-300">{errors[action]?.includes("already registered") ? tr("Сочетание занято другим приложением. Выберите другое.") : `Не удалось зарегистрировать: ${errors[action]}`}</div>}</div>
      
      <kbd className="rounded border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-mist-200">{capture === action ? tr("Нажмите сочетание…") : hotkeyLabel(shortcuts[action])}</kbd>
      
      {capture === action ? <Button onClick={() => void finish(action)}>{tr("Отмена")}</Button> : <Button disabled={busy || !!capture} onClick={() => void start(action)}>{tr("Изменить")}</Button>}
      
      <Button disabled={busy || !!capture || shortcuts[action] === DEFAULT_SHORTCUTS[action]} onClick={async () => { await start(action); if (captureRef.current === action) await finish(action, DEFAULT_SHORTCUTS[action]); }}>{tr("По умолчанию")}</Button>
    
    </div>)}</div></Card>
    
    <p className="text-xs text-mist-400">{tr("Во время записи сочетания управление горячими клавишами временно приостанавливается. Если клавиша занята другой программой, прежнее сочетание сохраняется.")}</p>
  
  </div></div>;
}
