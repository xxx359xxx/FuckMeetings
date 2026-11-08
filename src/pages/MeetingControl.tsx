import { tr } from "../lib/i18n";
import { useEffect, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export function MeetingControl() {
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    void listen<{ active: boolean; startedAt: number }>("meeting-state", (e) => { setStarted(e.payload.active ? e.payload.startedAt : 0); setStopping(false); }).then((fn) => { if (disposed) fn(); else { unlisten = fn; void emitTo("main", "meeting-control-ready"); } });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { disposed = true; unlisten?.(); clearInterval(timer); };
  }, []);
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  async function openMeeting() {
    await emitTo("main", "meeting-open");
    const main = await WebviewWindow.getByLabel("main");
    if (!main) throw new Error("Окно приложения недоступно");
    await main.show(); await main.unminimize(); await main.setFocus();
  }
  async function stop() {
    if (stopping || !started) return;
    setStopping(true);
    try { await emitTo("main", "meeting-stop"); await openMeeting(); }
    catch { setStopping(false); }
  }
  return <div className="flex h-full items-center justify-center bg-transparent px-2"><div className="flex items-center gap-2 rounded-full border border-violet-400/70 bg-[#11111d] px-2 py-1.5 text-white shadow-xl">
    
    <button onClick={() => void openMeeting().catch(console.error)} title={tr("Открыть встречу, не останавливая запись")} aria-label={tr("Открыть встречу, не останавливая запись")}><img src="/interviewkit-logo.png" alt="" className="h-8 w-8 rounded-lg" /></button>
    
    <div data-tauri-drag-region title={tr("Зажмите и перетащите панель")} className="flex h-10 cursor-grab items-center gap-2 rounded-lg px-2 active:cursor-grabbing">
      
      <span data-tauri-drag-region aria-hidden="true" className="grid grid-cols-2 gap-[3px] text-violet-200">{Array.from({ length: 6 }, (_, i) => <span data-tauri-drag-region key={i} className="h-[3px] w-[3px] rounded-full bg-current" />)}</span>
      
      <span data-tauri-drag-region className="h-2.5 w-2.5 rounded-full bg-red-500" />
      
      <span data-tauri-drag-region className="pointer-events-none font-mono text-sm tabular-nums">{time}</span>
    
    </div>
    
    <button onClick={() => void stop()} disabled={stopping || !started} aria-label={tr("Остановить запись и открыть встречу")} title={tr("Остановить запись и открыть встречу")} className="grid h-8 w-8 place-items-center rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50"><span className="h-3 w-3 rounded-sm bg-white" /></button>
  
  </div></div>;
}
