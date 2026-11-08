import { tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Play, Square, Check, FileText, AudioLines } from "lucide-react";
import { Channel, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Button, Card, ErrorBanner, Field, inputCls } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { completeChat } from "../lib/llm";
import { base64ToBytes, readFileBytes, writeFileBytes } from "../lib/resume";
import { transcribeRecording, toWhisperWav } from "../lib/transcription";
import { useSettings } from "../lib/settings";
import { cn, errMsg } from "../lib/utils";
import { useUpdateGate } from "../lib/updateGate";

type AudioTrack = { bytes: Uint8Array; name: string };
type Recording = { kind: "separate"; microphone: AudioTrack; system: AudioTrack } | { kind: "single"; audio: AudioTrack };

type ActiveCapture = { streams: MediaStream[]; recorders: MediaRecorder[]; stopping: boolean; macSystem: boolean; systemResult?: Promise<{ value: string } | { error: string }> };

type AudioEvent =
  | { kind: "pcm"; source: "mic" | "loopback"; samples_base64: string }
  | { kind: "level"; mic_rms: number; loopback_rms: number }
  | { kind: "failure"; message: string };
type NativeCapture = { microphone: Uint8Array[]; system: Uint8Array[]; stopping: boolean; failed: boolean; heardSystem: boolean; channel: Channel<AudioEvent> };

function pcmWav(frames: Uint8Array[]): Uint8Array {
  const length = frames.reduce((sum, frame) => sum + frame.length, 0);
  const out = new Uint8Array(44 + length); const view = new DataView(out.buffer);
  const write = (at: number, text: string) => { for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i); };
  write(0, "RIFF"); view.setUint32(4, length + 36, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, length, true);
  let offset = 44; for (const frame of frames) { out.set(frame, offset); offset += frame.length; }
  return out;
}

function AudioPreview({ track, label }: { track: AudioTrack; label: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const extension = track.name.split(".").pop()?.toLowerCase();
    const type = ({ wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg", flac: "audio/flac", mpeg: "audio/mpeg" } as Record<string, string>)[extension || ""] || "application/octet-stream";
    const objectUrl = URL.createObjectURL(new Blob([track.bytes.slice().buffer], { type }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [track]);
  return <div className="min-w-0"><p className="mb-1 text-xs font-medium text-mist-300">{label}</p>{url && <audio controls preload="metadata" src={url} className="h-9 w-full" />}</div>;
}

export function MeetingsPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useSettings((s) => s.settings);
  const [recordingData, setRecordingData] = useState<Recording | null>(null);
  const [myTranscript, setMyTranscript] = useState("");
  const [otherTranscript, setOtherTranscript] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [manualText, setManualText] = useState(false);
  const startedAt = useRef(0);
  const recordingRef = useRef(false); recordingRef.current = recording;
  const pendingTranscription = useRef(false);
  const stopRef = useRef<() => void>(() => {});
  const [mode, setMode] = useState<"both" | "mic">("both");
  const capture = useRef<ActiveCapture | null>(null);
  const nativeCapture = useRef<NativeCapture | null>(null);
  const [systemHeard, setSystemHeard] = useState(false);
  const mounted = useRef(true);
  const separated = recordingData?.kind === "separate";
  const updating = useUpdateGate((s) => s.installing);
  useEffect(() => {
    useUpdateGate.setState({ meetingActive: starting || recording, meetingData: !!recordingData || !!transcript || !!myTranscript || !!otherTranscript || !!summary });
  }, [starting, recording, recordingData, transcript, myTranscript, otherTranscript, summary]);

  function stopCapture() {
    const native = nativeCapture.current;
    if (native && !native.stopping) {
      native.stopping = true;
      void invoke("plugin:system-audio|stop").catch((e) => { if (mounted.current) setError(`Ошибка остановки записи: ${errMsg(e)}`); }).finally(() => {
        // The plugin stops its worker asynchronously; allow queued audio frames to arrive.
        setTimeout(() => {
          if (nativeCapture.current !== native) return;
          nativeCapture.current = null;
          if (!mounted.current) return;
          setRecording(false);
          if (!native.microphone.length) { setError("Микрофон не записал звук. Проверьте доступ к микрофону в Windows."); return; }
          const microphone = { bytes: pcmWav(native.microphone), name: "meeting-microphone.wav" };
          if (!native.system.length) {
            setRecordingData({ kind: "single", audio: microphone }); clearTexts();
            setError("Звук наушников не получен. Сохранена только дорожка микрофона. Проверьте, что наушники выбраны устройством вывода Windows и в них был звук.");
            return;
          }
          setRecordingData({ kind: "separate", microphone, system: { bytes: pcmWav(native.system), name: "meeting-system.wav" } });
          clearTexts();
          if (native.failed) setError("Запись была прервана из-за ошибки устройства; проверьте обе дорожки.");
          else if (!native.heardSystem) setError("Во время записи не обнаружено слышимого звука наушников. Проверьте выбранное устройство вывода и воспроизведите дорожку перед распознаванием.");
        }, 350);
      });
      return;
    }
    const session = capture.current;
    if (!session || session.stopping) return;
    session.stopping = true;
    if (session.macSystem) session.systemResult = invoke<string>("stop_mac_audio").then((value) => ({ value }), (error) => ({ error: errMsg(error) }));
    session.recorders.forEach((r) => { if (r.state !== "inactive") r.stop(); });
  }
  stopRef.current = () => { if (!recordingRef.current) return; pendingTranscription.current = true; stopCapture(); };
  useEffect(() => {
    let disposed = false; const cleanups: (() => void)[] = [];
    for (const promise of [
      listen("meeting-stop", () => stopRef.current()),
      listen("meeting-control-ready", () => void emitTo("meeting-control", "meeting-state", { active: recordingRef.current, startedAt: startedAt.current })),
    ]) void promise.then((fn) => { if (disposed) fn(); else cleanups.push(fn); });
    return () => { disposed = true; cleanups.forEach((fn) => fn()); };
  }, []);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const control = await WebviewWindow.getByLabel("meeting-control");
      if (disposed) return;
      if (recording) { await control?.show(); if (!disposed) await emitTo("meeting-control", "meeting-state", { active: true, startedAt: startedAt.current }); }
      else { await emitTo("meeting-control", "meeting-state", { active: false, startedAt: 0 }); if (!disposed) await control?.hide(); }
    })().catch((e) => { if (!disposed && mounted.current) setError(`Не удалось открыть управление записью: ${errMsg(e)}`); });
    return () => { disposed = true; };
  }, [recording]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopCapture();
      capture.current?.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    };
  }, []);

  function clearTexts() { setTranscript(""); setMyTranscript(""); setOtherTranscript(""); setSummary(""); }
  async function chooseAudio() {
    try {
      const path = await open({ multiple: false, filters: [{ name: "Аудио", extensions: ["wav", "mp3", "m4a", "mp4", "mpeg", "webm", "ogg", "flac"] }] });
      if (!path || Array.isArray(path)) return;
      setRecordingData({ kind: "single", audio: { bytes: await readFileBytes(path), name: path.split(/[\\/]/).pop() || "audio.wav" } });
      clearTexts(); setError("");
    } catch (e) { setError(errMsg(e)); }
  }

  async function record() {
    if (starting || recording || useUpdateGate.getState().installing) return;
    useUpdateGate.setState({ meetingActive: true });
    setStarting(true); setError("");
    const streams: MediaStream[] = [];
    let macSystemStarted = false;
    try {
      if (mode === "both" && /Windows/i.test(navigator.userAgent)) {
        const channel = new Channel<AudioEvent>();
        const native: NativeCapture = { microphone: [], system: [], stopping: false, failed: false, heardSystem: false, channel };
        nativeCapture.current = native; setSystemHeard(false);
        channel.onmessage = (event) => {
          if (nativeCapture.current !== native) return;
          if (event.kind === "pcm") {
            (event.source === "mic" ? native.microphone : native.system).push(base64ToBytes(event.samples_base64));
          } else if (event.kind === "level" && event.loopback_rms > 0.001) {
            if (!native.heardSystem && mounted.current) setSystemHeard(true);
            native.heardSystem = true;
          } else if (event.kind === "failure") {
            native.failed = true;
            if (mounted.current) setError(`Ошибка записи: ${event.message}`);
            stopCapture();
          }
        };
        try { await invoke("plugin:system-audio|start", { options: { loopback: true, processing: false, levelOnly: false }, channel }); }
        catch (e) { nativeCapture.current = null; throw e; }
        if (mounted.current) { setRecordingData(null); clearTexts(); startedAt.current = Date.now(); setRecording(true); } else stopCapture();
        return;
      }
      // Screen capture must be requested directly from the button click, before other awaits.
      let system: MediaStream | null = null;
      const macSystem = mode === "both" && /Mac/i.test(navigator.platform || navigator.userAgent);
      if (mode === "both" && !macSystem) {
        if (!navigator.mediaDevices.getDisplayMedia) throw new Error("Этот WebView не поддерживает захват системного звука. Выберите только микрофон или загрузите запись.");
        system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.push(system);
        if (!system.getAudioTracks().length) throw new Error("Системный звук не передан. Выберите только микрофон или загрузите аудиозапись.");
      }
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      streams.push(mic);
      if (macSystem) { await invoke("start_mac_audio"); macSystemStarted = true; }
      const selected = system ? [mic, system] : [mic];
      const recorders = selected.map((s) => new MediaRecorder(new MediaStream(s.getAudioTracks())));
      const session: ActiveCapture = { streams, recorders, stopping: false, macSystem };
      capture.current = session;
      const outputs = recorders.map((rec) => new Promise<Blob>((resolve, reject) => {
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onerror = () => reject(new Error("Ошибка записи аудио."));
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      }));
      for (const track of streams.flatMap((s) => s.getTracks())) track.addEventListener("ended", stopCapture, { once: true });
      recorders.forEach((rec) => rec.start());
      setRecordingData(null); clearTexts(); startedAt.current = Date.now(); setRecording(true);
      // Every recorder completes before we release the capture streams.
      void Promise.all(outputs).then(async (blobs) => {
        const tracks = await Promise.all(blobs.map(async (blob, i) => ({ bytes: new Uint8Array(await blob.arrayBuffer()), name: system ? (i === 0 ? "meeting-microphone.webm" : "meeting-system.webm") : "meeting-microphone.webm" })));
        if (tracks.some((track) => !track.bytes.length)) throw new Error("Одна из дорожек записи пуста. Проверьте источники звука.");
        if (!mounted.current) return;
        if (system) setRecordingData({ kind: "separate", microphone: tracks[0], system: tracks[1] });
        else if (macSystem) {
          try {
            if (!session.systemResult) throw new Error("Запись системного звука не была завершена.");
            const result = await session.systemResult;
            if ("error" in result) throw new Error(result.error);
            const bytes = base64ToBytes(result.value);
            setRecordingData({ kind: "separate", microphone: tracks[0], system: { bytes, name: "meeting-system.wav" } });
          } catch (e) {
            setRecordingData({ kind: "single", audio: tracks[0] });
            setError(`Сохранён только микрофон. Не удалось получить системный звук: ${errMsg(e)}`);
          }
        } else setRecordingData({ kind: "single", audio: tracks[0] });
        clearTexts();
      }).catch((e) => { if (mounted.current) setError(`Не удалось сохранить запись: ${errMsg(e)}`); }).finally(() => {
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        if (capture.current === session) capture.current = null;
        if (mounted.current) setRecording(false);
      });
    } catch (e) {
      if (macSystemStarted) { try { await invoke("stop_mac_audio"); } catch { /* preserve the original error */ } }
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      capture.current = null;
      const detail = errMsg(e);
      setError(detail.includes("audio session already running") ? "Аудиозапись уже используется. Остановите прослушивание в скрытом помощнике и попробуйте снова." : `Не удалось начать запись: ${detail}`);
    } finally { if (mounted.current) setStarting(false); }
  }
  async function saveTrack(track: AudioTrack) {
    try { const path = await save({ defaultPath: track.name }); if (path) await writeFileBytes(path, track.bytes); }
    catch (e) { setError(errMsg(e)); }
  }
  async function saveText(text: string, filename: string) {
    try { const path = await save({ defaultPath: filename, filters: [{ name: "Текст", extensions: ["md", "txt"] }] }); if (path) await writeFileBytes(path, new TextEncoder().encode(text)); }
    catch (e) { setError(errMsg(e)); }
  }
  async function recognize(track: AudioTrack): Promise<string> {
    if (settings.transcriptionMode !== "local" || track.name.toLowerCase().endsWith(".wav")) return transcribeRecording(track.bytes, track.name, settings);
    const bytes = await toWhisperWav(new Blob([track.bytes.slice().buffer]));
    return transcribeRecording(bytes, "meeting.wav", settings);
  }
  async function transcribe(clearError = true) {
    if (!recordingData) return;
    setBusy("Распознаю запись…"); if (clearError) setError(""); setSummary("");
    try {
      if (recordingData.kind === "separate") {
        setMyTranscript(""); setOtherTranscript("");
        const recognizeAllowSilence = async (track: AudioTrack) => {
          try { return await recognize(track); }
          catch (e) { if (errMsg(e).includes("не обнаружил речь")) return "[Речь не обнаружена]"; throw e; }
        };
        setBusy("Распознаю твой микрофон…");
        const mine = await recognizeAllowSilence(recordingData.microphone);
        setMyTranscript(mine);
        setBusy("Распознаю собеседников…");
        const theirs = await recognizeAllowSilence(recordingData.system);
        setOtherTranscript(theirs);
      } else setTranscript(await recognize(recordingData.audio));
    } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  }
  const transcriptForSummary = separated ? `=== МОЙ МИКРОФОН ===\n${myTranscript}\n\n=== ЗВУК СОБЕСЕДНИКОВ ===\n${otherTranscript}` : transcript;
  const canSummarize = separated ? !!(myTranscript.trim() && otherTranscript.trim() && (myTranscript.trim() !== "[Речь не обнаружена]" || otherTranscript.trim() !== "[Речь не обнаружена]")) : !!transcript.trim();
  async function summarize() {
    if (!canSummarize) return;
    setBusy("Готовлю итоги…"); setError(""); setSummary("");
    try {
      let result = "";
      await completeChat({ provider: settings.activeProvider, config: settings.providers[settings.activeProvider], messages: [
        { role: "system", content: "Составь точные итоги встречи по транскрипции. Если есть дорожки «МОЙ МИКРОФОН» и «ЗВУК СОБЕСЕДНИКОВ», различай мои предложения и действия, сказанное и порученное мне собеседниками, общие решения и следующие шаги. Дорожки идут раздельно, не восстанавливай порядок разговора без доказательств; на одной дорожке может быть несколько людей и возможны помехи или эхо. Не приписывай словам имена и не выдумывай поручения, сроки и факты; если ответственный или срок не указан, явно укажи это. Если не хватает контекста, отметь неопределённость. Если дорожки не разделены, не угадывай, кто что сказал. Оформи результат на языке разговора в Markdown с разделами «Кратко», «Решения», «Задачи и поручения», «Открытые вопросы» и при необходимости «Мои предложения». Для задач укажи ответственного и срок только если они названы; при отсутствии сведений так и напиши." },
        { role: "user", content: transcriptForSummary },
      ], onDelta: (delta) => { result += delta; setSummary(result); } });
    } catch (e) { setError(errMsg(e)); } finally { setBusy(""); }
  }

  useEffect(() => {
    if (!pendingTranscription.current || recording) return;
    pendingTranscription.current = false;
    if (recordingData) void transcribe(false);
  }, [recording, recordingData]);
  const stage = !recording && summary ? 3 : !recording && (recordingData || transcript.trim()) ? 2 : 1;
  const durationMessage = recording ? "Запись идёт" : recordingData ? "Запись завершена" : "Готово к записи";
  return <div className="h-full overflow-y-auto"><div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
    
    <header><h1 className="text-lg font-semibold">{tr("Встречи")}</h1><p className="text-sm text-mist-400">{tr("Запись, расшифровка и итоги встречи")}</p></header>
    
    <div className="flex items-center gap-2 text-xs sm:text-sm" aria-label={tr("Этап встречи")}>{[tr("Запись"), tr("Текст"), tr("Итоги")].map((label, i) => <div key={label} className="flex flex-1 items-center gap-2"><span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border", stage >= i + 1 ? "border-accent-400 bg-accent-500/20 text-accent-400" : "border-ink-600 text-mist-400")}>{stage > i + 1 ? <Check size={15} /> : i + 1}</span><span className={stage === i + 1 ? "font-semibold text-mist-100" : "text-mist-400"}>{label}</span>{i < 2 && <span className="h-px flex-1 bg-ink-600" />}</div>)}</div>
    
    {error && <ErrorBanner text={error} onClose={() => setError("")} />}
    
    {busy && <div role="status" className="rounded-lg border border-accent-500/30 bg-accent-500/10 px-4 py-3 text-sm text-accent-400">{tr(busy)}</div>}
    
    <Card>
      
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        
        <div className={cn("text-xs font-medium", recording ? "text-red-400" : "text-mist-400")}>{recording && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />}{tr(durationMessage)}</div>
        
        {recording ? <Button onClick={() => stopRef.current()} className="min-w-52"><Square size={16} /> {tr("Остановить запись")}</Button> : <Button variant="primary" onClick={() => void record()} disabled={starting || !!busy || updating} className="min-w-52"><Play size={16} fill="currentColor" />{starting ? tr("Запускаю…") : tr("Начать запись")}</Button>}
        
        {recording ? <><p className="max-w-lg text-xs text-mist-400">{mode === "both" && /Windows/i.test(navigator.userAgent) ? (systemHeard ? tr("Микрофон и системный звук записываются.") : tr("Запись включена, ожидаю системный звук.")) : mode === "both" && /Mac/i.test(navigator.platform || navigator.userAgent) ? "Запись микрофона и системного звука запущена." : tr("Микрофон записывается.")} {tr("Перетащите панель за точки. Значок открывает встречу, красная кнопка останавливает запись.")}</p><Button onClick={() => void getCurrentWindow().hide()}>{tr("Скрыть приложение")}</Button></> : <div className="w-full max-w-lg text-left"><Field label={tr("Источник звука")}><select aria-label={tr("Источник звука")} className={cn(inputCls, "w-full")} disabled={starting || !!busy} value={mode} onChange={(e) => setMode(e.target.value as "both" | "mic")}><option value="both">{tr("Мой микрофон + звук компьютера")}</option><option value="mic">{tr("Только микрофон")}</option></select></Field><p className="mt-2 text-xs text-mist-400">{/Mac/i.test(navigator.platform || navigator.userAgent) ? "Для звука компьютера macOS может запросить доступ к записи экрана и системного звука. Проверьте обе дорожки после записи. При использовании колонок возможен звук собеседника в дорожке микрофона." : tr("Системный звук записывается с устройства вывода по умолчанию. Сообщите участникам о записи.")}</p></div>}
        
        {!recording && <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => void chooseAudio()} disabled={starting || !!busy}>{tr("Загрузить аудиофайл")}</Button><Button onClick={() => setManualText(true)} disabled={starting || !!busy}>{tr("Вставить текст встречи")}</Button></div>}
      
      </div>
      
      {recordingData && !recording && <details className="mt-2 border-t border-ink-700 pt-3"><summary className="cursor-pointer text-xs text-mist-400">{tr("Прослушать или сохранить запись")}</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{recordingData.kind === "separate" ? <><AudioPreview label={tr("Мой микрофон")} track={recordingData.microphone} /><AudioPreview label={tr("Звук компьютера")} track={recordingData.system} /></> : <AudioPreview label={tr("Запись")} track={recordingData.audio} />}</div><div className="mt-3 flex flex-wrap gap-2">{recordingData.kind === "separate" ? <><Button onClick={() => void saveTrack(recordingData.microphone)}>{tr("Сохранить микрофон")}</Button><Button onClick={() => void saveTrack(recordingData.system)}>{tr("Сохранить системный звук")}</Button></> : <Button onClick={() => void saveTrack(recordingData.audio)}>{tr("Сохранить аудио")}</Button>}</div><p className="mt-2 text-xs text-mist-400">{tr("Сохраните запись до закрытия приложения.")}</p></details>}
    
    </Card>
    
    {(recordingData || manualText || transcript || myTranscript || otherTranscript) && !recording && <div className="grid items-start gap-5 lg:grid-cols-2">
      
      <Card><div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} /> {tr("Расшифровка")}</h2>{recordingData && <Button disabled={!!busy} onClick={() => void transcribe()}>{canSummarize ? tr("Распознать заново") : tr("Распознать запись")}</Button>}</div>
        
        {separated ? <div className="grid gap-3"><Field label={tr("Мой микрофон")} hint={tr("можно исправить")}><textarea className={cn(inputCls, "min-h-36 w-full resize-y")} value={myTranscript} onChange={(e) => setMyTranscript(e.target.value)} /></Field><Field label={tr("Собеседники / системный звук")} hint={tr("можно исправить")}><textarea className={cn(inputCls, "min-h-36 w-full resize-y")} value={otherTranscript} onChange={(e) => setOtherTranscript(e.target.value)} /></Field></div> : <Field label={tr("Текст встречи")} hint={tr("можно исправить")}><textarea className={cn(inputCls, "min-h-64 w-full resize-y")} value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Field>}
        
        {separated && <p className="mt-2 text-xs text-mist-400">{tr("Дорожки разделены по источнику, порядок реплик и имена собеседников не определяются автоматически.")}</p>}
        
        <div className="mt-3 flex flex-wrap gap-2"><Button disabled={separated ? !(myTranscript.trim() || otherTranscript.trim()) : !transcript.trim()} onClick={() => void saveText(transcriptForSummary, "transcript.txt")}>{tr("Сохранить текст")}</Button><Button onClick={onOpenSettings}>{tr("Настройки распознавания")}</Button></div>
      
      </Card>
      
      <Card><div className="mb-3 flex items-center gap-2"><AudioLines size={16} /><h2 className="text-sm font-semibold">{tr("Итоги встречи")}</h2></div>{summary ? <div className="text-sm"><Markdown>{summary}</Markdown></div> : <p className="text-sm leading-relaxed text-mist-400">{tr("После расшифровки получите краткое содержание, решения, задачи и открытые вопросы.")}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="primary" disabled={!canSummarize || !!busy} onClick={() => void summarize()}>{summary ? tr("Обновить итоги") : tr("Получить итоги")}</Button>{summary && <Button onClick={() => void saveText(summary, "meeting-summary.md")}>{tr("Сохранить итоги")}</Button>}</div></Card>
    
    </div>}
  
  </div></div>;
}
