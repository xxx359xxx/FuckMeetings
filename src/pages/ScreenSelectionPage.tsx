import { tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

type Point = { x: number; y: number };
export function ScreenSelectionPage() {
  const [image, setImage] = useState("");
  const [start, setStart] = useState<Point | null>(null), [end, setEnd] = useState<Point | null>(null);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const startRef = useRef<Point | null>(null);
  const load = async () => { setError(""); setStart(null); setEnd(null); startRef.current = null; setImage((await invoke<string | null>("get_pending_capture")) || ""); };
  useEffect(() => {
    void load(); let unlisten: (() => void) | undefined; let disposed = false;
    void listen("selection-open", () => void load()).then((fn) => { if (disposed) fn(); else unlisten = fn; });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { void getCurrentWindow().hide(); void invoke("clear_pending_capture"); setImage(""); } };
    window.addEventListener("keydown", onKey);
    return () => { disposed = true; unlisten?.(); window.removeEventListener("keydown", onKey); };
  }, []);
  const finish = async (p: Point) => {
    const first = startRef.current; const img = imageRef.current; if (!first || !img) return;
    startRef.current = null;
    const box = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(first.x, p.x)), y = Math.max(0, Math.min(first.y, p.y));
    const w = Math.min(box.width - x, Math.abs(p.x - first.x)), h = Math.min(box.height - y, Math.abs(p.y - first.y));
    if (w < 5 || h < 5) { setStart(null); setEnd(null); setError("Выделите область мышью или нажмите Esc для отмены."); return; }
    const canvas = document.createElement("canvas");
    const sx = img.naturalWidth / box.width, sy = img.naturalHeight / box.height;
    canvas.width = Math.max(1, Math.round(w * sx)); canvas.height = Math.max(1, Math.round(h * sy));
    const ctx = canvas.getContext("2d"); if (!ctx) { setError("Не удалось подготовить изображение."); return; }
    ctx.drawImage(img, x * sx, y * sy, w * sx, h * sy, 0, 0, canvas.width, canvas.height);
    try {
      const result = canvas.toDataURL("image/png");
      await getCurrentWindow().hide();
      const overlay = await WebviewWindow.getByLabel("overlay"); await overlay?.show();
      await emitTo("overlay", "overlay-screen-send", result);
      await invoke("clear_pending_capture"); setImage("");
    } catch (e) { setError(`Не удалось отправить снимок: ${String(e)}`); }
  };
  const rect = start && end ? { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) } : null;
  return <div className="relative h-screen w-screen cursor-crosshair select-none overflow-hidden" onPointerDown={(e) => { if (!image || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); const p = { x: e.clientX, y: e.clientY }; startRef.current = p; setStart(p); setEnd(p); }} onPointerMove={(e) => { if (startRef.current) setEnd({ x: e.clientX, y: e.clientY }); }} onPointerUp={(e) => { if (startRef.current) void finish({ x: e.clientX, y: e.clientY }); }}>
    
    {image && <img ref={imageRef} src={image} draggable={false} className="absolute inset-0 h-full w-full" />}
    
    <div className="pointer-events-none absolute inset-0 bg-black/35" />
    
    {rect && <div className="pointer-events-none absolute border-2 border-white bg-white/10" style={rect} />}
    
    <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-sm text-white">{error ? tr(error) : tr("Выделите область мышью · Esc — отмена")}</div>
  
  </div>;
}
