import { tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { base64ToBytes } from "../lib/resume";
import { transcribeRecording } from "../lib/transcription";
import { useSettings } from "../lib/settings";
import { errMsg } from "../lib/utils";
import { Button } from "./ui";

type AudioEvent = { kind: "pcm"; source: "mic" | "loopback"; samples_base64: string } | { kind: "failure"; message: string } | { kind: "level" };
function wav(frames: Uint8Array[]) {
  const length = frames.reduce((n, f) => n + f.length, 0);
  const result = new Uint8Array(44 + length), v = new DataView(result.buffer);
  const str = (p: number, s: string) => { for (let i = 0; i < s.length; i++) result[p + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, length + 36, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, length, true);
  let offset = 44; for (const frame of frames) { result.set(frame, offset); offset += frame.length; } return result;
}
export function SystemSpeechCapture({ onText, flushRef }: { onText: (text: string) => void; flushRef: React.MutableRefObject<(() => Promise<void>) | null> }) {
  const settings = useSettings((s) => s.settings);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const textRef = useRef(onText); textRef.current = onText;
  const [active, setActive] = useState(false), [error, setError] = useState("");
  const capturingScreen = useRef(false);
  useEffect(() => { let disposed = false; let cleanup: (() => void) | undefined; void listen<boolean>("capture-in-progress", (e) => { capturingScreen.current = e.payload; }).then((fn) => { if (disposed) fn(); else cleanup = fn; }); return () => { disposed = true; cleanup?.(); }; }, []);
  const mounted = useRef(true), running = useRef(false), frames = useRef<Uint8Array[]>([]), samples = useRef(0), quiet = useRef(0), heard = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const submit = () => {
    const chunk = frames.current; frames.current = []; samples.current = 0; quiet.current = 0;
    const hadVoice = heard.current; heard.current = false;
    if (!chunk.length || !hadVoice) return;
    const snapshot = { ...settingsRef.current };
    queue.current = queue.current.then(async () => { try { const text = await transcribeRecording(wav(chunk), "system.wav", snapshot); if (mounted.current && text.trim()) textRef.current(text.trim()); } catch (e) { if (mounted.current) setError(`Ошибка распознавания: ${errMsg(e)}`); } });
  };
  flushRef.current = async () => { submit(); await queue.current; };
  const stop = async () => {
    if (!running.current) return; running.current = false;
    try { await invoke("plugin:system-audio|stop"); } catch (e) { if (mounted.current) setError(errMsg(e)); }
    submit(); if (mounted.current) setActive(false);
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void stop(); }; }, []);
  useEffect(() => { if (!active) return; const timer = setInterval(() => { void getCurrentWindow().isVisible().then((visible) => { if (!visible && !capturingScreen.current) void stop(); }); }, 1000); return () => clearInterval(timer); }, [active]);
  const start = async () => {
    setError("");
    const channel = new Channel<AudioEvent>();
    channel.onmessage = (event) => {
      if (!running.current) return;
      if (event.kind === "failure") { setError(event.message); void stop(); return; }
      if (event.kind !== "pcm" || event.source !== "loopback") return;
      const data = base64ToBytes(event.samples_base64); frames.current.push(data); samples.current += data.length / 2;
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength); let sum = 0;
      for (let i = 0; i + 1 < data.length; i += 2) { const value = view.getInt16(i, true) / 32768; sum += value * value; }
      if (Math.sqrt(sum / Math.max(1, data.length / 2)) > 0.012) { heard.current = true; quiet.current = 0; } else quiet.current += data.length / 2;
      if ((heard.current && quiet.current >= 19200 && samples.current >= 24000) || samples.current >= 160000) submit();
    };
    running.current = true;
    try { await invoke("plugin:system-audio|start", { options: { loopback: true, processing: false, levelOnly: false }, channel }); if (mounted.current) setActive(true); else void stop(); }
    catch (e) { running.current = false; setError(`Не удалось включить системный звук: ${errMsg(e)}`); }
  };
  return <div className="flex flex-wrap items-center gap-2"><Button onClick={() => void (active ? stop() : start())}>{active ? tr("Остановить") : tr("Начать")}</Button><span className="text-[11px] text-mist-400">{active ? tr("Слушаю системный звук") : tr("Системный звук")}</span>{error && <span role="alert" className="text-[11px] text-red-300">{tr(error)}</span>}</div>;
}
