import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Mic, Square } from "lucide-react";
import { useSettings } from "../lib/settings";
import { transcribeRecording, toWhisperWav } from "../lib/transcription";
import { errMsg } from "../lib/utils";
import { Button, inputCls } from "./ui";

/** Records independently decodable short segments; each uses the same provider as Meetings. */
export function SpeechCapture({ onText, compact = false, flushRef }: { onText: (text: string) => void; compact?: boolean; flushRef?: React.MutableRefObject<(() => Promise<void>) | null> }) {
  const settings = useSettings((s) => s.settings);
  const [source, setSource] = useState<"microphone" | "screen">("microphone");
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const backlog = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const stopEvent = useRef<Promise<void>>(Promise.resolve());
  const captureError = useRef("");
  const onTextRef = useRef(onText); onTextRef.current = onText;

  if (flushRef) flushRef.current = async () => {
    stop();
    await stopEvent.current;
    await queue.current;
    if (captureError.current) throw new Error(captureError.current);
  };

  function stop() {
    running.current = false;
    if (silenceTimer.current) clearInterval(silenceTimer.current);
    silenceTimer.current = null;
    if (audioContext.current) void audioContext.current.close();
    audioContext.current = null; analyser.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (mounted.current) setActive(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stop(); };
  }, []);
  useEffect(() => {
    if (!compact || !active) return;
    const id = setInterval(() => {
      void getCurrentWindow().isVisible().then((visible) => { if (!visible) stop(); }).catch(() => stop());
    }, 1000);
    return () => clearInterval(id);
  }, [compact, active]);

  async function start() {
    setError(""); captureError.current = "";
    if (settings.transcriptionMode === "deepgram" && !settings.deepgramKey.trim()) { setError("Укажите ключ Deepgram в настройках транскрибатора."); return; }
    if (settings.transcriptionMode === "api" && (!settings.transcriptionUrl.trim() || !settings.transcriptionModel.trim())) { setError("Укажите адрес и модель транскрибатора в настройках."); return; }
    if (settings.transcriptionMode === "local" && (!settings.whisperExecutable || !settings.whisperModelPath)) { setError("Укажите whisper-cli и модель в настройках транскрибатора."); return; }
    try {
      let audio: MediaStream;
      if (source === "screen") {
        if (!navigator.mediaDevices.getDisplayMedia) throw new Error("Захват звука экрана не поддерживается. Выберите микрофон или системный аудиовход.");
        audio = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (!audio.getAudioTracks().length) { audio.getTracks().forEach((t) => t.stop()); throw new Error("Источник не предоставил звук. Включите передачу звука в окне выбора."); }
      } else audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { audio.getTracks().forEach((track) => track.stop()); return; }
      stream.current = audio; running.current = true; setActive(true);
      const context = new AudioContext();
      audioContext.current = context;
      const meter = context.createAnalyser(); meter.fftSize = 1024;
      context.createMediaStreamSource(new MediaStream(audio.getAudioTracks())).connect(meter);
      analyser.current = meter;
      const snapshot = { ...settings };
      const recordSegment = () => {
        if (!running.current || !stream.current) return;
        const rec = new MediaRecorder(new MediaStream(stream.current.getAudioTracks())); recorder.current = rec;
        let resolveStop!: () => void;
        stopEvent.current = new Promise<void>((resolve) => { resolveStop = resolve; });
        const parts: BlobPart[] = [];
        rec.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
        rec.onerror = () => { captureError.current = "Ошибка записи аудио."; if (mounted.current) setError(captureError.current); stop(); };
        rec.onstop = () => {
          if (!mounted.current) { resolveStop(); return; }
          const blob = new Blob(parts, { type: rec.mimeType || "audio/webm" });
          if (blob.size) {
            backlog.current += 1; if (mounted.current) setPending(backlog.current);
            queue.current = queue.current.then(async () => {
              try {
                const local = snapshot.transcriptionMode === "local";
                const audioBytes = local ? await toWhisperWav(blob) : new Uint8Array(await blob.arrayBuffer());
                const text = await transcribeRecording(audioBytes, local ? "interview.wav" : "interview.webm", snapshot);
                if (mounted.current && text.trim()) onTextRef.current(text.trim());
              } catch (e) {
                const message = errMsg(e);
                if (!message.includes("не обнаружил речь")) { captureError.current = message; if (mounted.current) setError(message); stop(); }
              } finally { backlog.current -= 1; if (mounted.current) setPending(backlog.current); }
            });
            if (backlog.current > 3) { captureError.current = "Распознавание не успевает за записью. Прослушивание остановлено; дождитесь обработки."; if (mounted.current) setError(captureError.current); stop(); }
          }
          resolveStop();
          if (running.current) recordSegment();
        };
        let heardSpeech = false;
        let lastSpeech = Date.now();
        const started = Date.now();
        if (silenceTimer.current) clearInterval(silenceTimer.current);
        silenceTimer.current = setInterval(() => {
          if (rec.state !== "recording" || !analyser.current) return;
          const samples = new Uint8Array(analyser.current.fftSize);
          analyser.current.getByteTimeDomainData(samples);
          let sum = 0; for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          if (Math.sqrt(sum / samples.length) > 0.012) { heardSpeech = true; lastSpeech = Date.now(); }
          if (heardSpeech && Date.now() - lastSpeech > 1200 && Date.now() - started > 1500) rec.stop();
        }, 150);
        rec.start(); timer.current = setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 10000);
      };
      audio.getAudioTracks()[0]?.addEventListener("ended", () => stop(), { once: true });
      recordSegment();
    } catch (e) { stop(); if (mounted.current) setError(`Не удалось начать прослушивание: ${errMsg(e)}`); }
  }
  return <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-2.5">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Источник звука интервью" className={`${inputCls} min-w-0 flex-1 py-1 text-xs`} value={source} disabled={active || pending > 0} onChange={(e) => setSource(e.target.value as "microphone" | "screen")}><option value="microphone">Микрофон</option><option value="screen">Звук экрана</option></select>
      {active ? <Button onClick={stop} className="text-xs"><Square size={13} /> Остановить</Button> : <Button onClick={() => void start()} disabled={pending > 0} className="text-xs"><Mic size={13} /> Слушать</Button>}
    </div>
    <p className="mt-1.5 text-[11px] text-mist-400">{active ? "Слушаю: текст появляется после паузы или примерно через 10 секунд." : pending ? "Обрабатываю последние фрагменты…" : "Речь сохраняется в буфере; отправьте её кнопкой ответа или Ctrl+Shift+Enter."} {settings.transcriptionMode === "deepgram" ? "Deepgram" : settings.transcriptionMode === "local" ? "Локальная модель" : "API транскрибатора"}.</p>
    {error && <p role="alert" className="mt-1 text-[11px] text-red-300 break-words">{error}</p>}
  </div>;
}
