import { invoke } from "@tauri-apps/api/core";
import { bytesToBase64 } from "./resume";
import type { Settings } from "./types";

export async function toWhisperWav(blob: Blob): Promise<Uint8Array> {
  const source = new AudioContext();
  try {
    const decoded = await source.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const node = offline.createBufferSource(); node.buffer = decoded; node.connect(offline.destination); node.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const result = new Uint8Array(44 + pcm.length * 2); const view = new DataView(result.buffer);
    const str = (at: number, value: string) => { for (let n = 0; n < value.length; n++) view.setUint8(at + n, value.charCodeAt(n)); };
    str(0, "RIFF"); view.setUint32(4, result.length - 8, true); str(8, "WAVE"); str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (let n = 0; n < pcm.length; n++) { const v = Math.max(-1, Math.min(1, pcm[n])); view.setInt16(44 + n * 2, v < 0 ? v * 32768 : v * 32767, true); }
    return result;
  } finally { await source.close(); }
}


export async function transcribeRecording(audio: Uint8Array, name: string, settings: Settings): Promise<string> {
  const data = bytesToBase64(audio);
  if (settings.transcriptionMode === "local") {
    if (/\.en(?:-q[0-9_]+)?\.bin$/i.test(settings.whisperModelPath) && settings.transcriptionLanguage !== "en") throw new Error("Установленная модель поддерживает только английский. Скачайте многоязычную модель для выбранного языка.");
    if (!settings.whisperExecutable || !settings.whisperModelPath) throw new Error("Укажите программу whisper-cli и файл модели в настройках транскрибатора.");
    if (!name.toLowerCase().endsWith(".wav")) throw new Error("Для локального whisper.cpp требуется WAV PCM (16 кГц, mono).");
    return invoke<string>("transcribe_local", { data, executable: settings.whisperExecutable, modelPath: settings.whisperModelPath, language: settings.transcriptionLanguage });
  }
  if (settings.transcriptionMode === "deepgram") {
    if (!settings.deepgramKey.trim()) throw new Error("Укажите API-ключ Deepgram в настройках транскрибатора.");
    if (!settings.deepgramModel.trim()) throw new Error("Укажите модель Deepgram в настройках транскрибатора.");
    return invoke<string>("transcribe_deepgram", { data, filename: name, apiKey: settings.deepgramKey, model: settings.deepgramModel, language: settings.transcriptionLanguage });
  }
  if (!settings.transcriptionUrl.trim() || !settings.transcriptionModel.trim()) throw new Error("Укажите адрес API и модель транскрибатора.");
  if (settings.transcriptionUrl.includes("api.openai.com") && audio.length > 25 * 1024 * 1024) throw new Error("Для OpenAI размер записи должен быть не более 25 МБ. Разделите запись на части.");
  return invoke<string>("transcribe_audio", { data, filename: name, baseUrl: settings.transcriptionUrl, apiKey: settings.transcriptionKey, model: settings.transcriptionModel, language: settings.transcriptionLanguage });
}
