import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useUpdateGate } from "../lib/updateGate";

export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const meetingActive = useUpdateGate((s) => s.meetingActive);
  useEffect(() => {
    let disposed = false;
    let found: Update | null = null;
    void (async () => {
      if (!await invoke<boolean>("updater_configured")) return;
      found = await check({ timeout: 15000 });
      if (disposed) { await found?.close(); return; }
      setUpdate(found);
    })().catch((err) => console.warn("Проверка обновлений недоступна:", err));
    return () => { disposed = true; if (found) void found.close().catch(console.error); };
  }, []);
  async function install() {
    if (!update || busy) return;
    if (useUpdateGate.getState().meetingActive) { setMessage("Дождитесь завершения записи и сохраните её перед обновлением."); return; }
    setBusy(true); setMessage(""); useUpdateGate.setState({ installing: true });
    try {
      let received = 0, total = 0;
      await update.download((event) => {
        if (event.event === "Started") total = event.data.contentLength || 0;
        if (event.event === "Progress") { received += event.data.chunkLength; if (total) setPercent(Math.min(100, Math.round(received / total * 100))); }
      });
      if (useUpdateGate.getState().meetingActive) { setMessage("Запись ещё идёт. Завершите и сохраните её перед обновлением."); return; }
      const warning = useUpdateGate.getState().meetingData
        ? "В приложении есть данные встречи, которые могут храниться только в памяти. Сохраните их перед обновлением. Вы уже сохранили всё необходимое?"
        : "Приложение перезапустится для установки обновления. Сохраните все несохранённые данные. Продолжить?";
      if (!window.confirm(warning)) { setMessage("Установка отложена."); return; }
      if (useUpdateGate.getState().meetingActive) { setMessage("Завершите запись перед обновлением."); return; }
      setMessage("Устанавливаю обновление…");
      await update.install();
      await relaunch();
    } catch (err) { setMessage(`Не удалось обновить приложение: ${String(err)}`); }
    finally { useUpdateGate.setState({ installing: false }); setBusy(false); }
  }
  if (!update || dismissed) return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 border-b border-accent-500/30 bg-accent-500/10 px-5 py-3 text-sm text-mist-100">
    <span className="min-w-0 flex-1">Доступна новая версия {update.version}.{message && <> {message}</>}</span>
    <button type="button" disabled={busy || meetingActive} onClick={() => void install()} className="rounded bg-accent-500 px-3 py-1.5 font-medium text-white disabled:opacity-50">{busy ? percent === null ? "Загружаю…" : `Загружаю ${percent}%` : "Обновить"}</button>
    {!busy && <button type="button" onClick={() => setDismissed(true)} className="rounded px-2 py-1 text-mist-300">Позже</button>}
    {meetingActive && <span className="w-full text-xs text-mist-300">Обновление доступно после завершения записи.</span>}
  </div>;
}
