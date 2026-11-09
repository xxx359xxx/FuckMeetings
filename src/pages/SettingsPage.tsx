import { tr } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Channel, invoke } from "@tauri-apps/api/core";
import {
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Keyboard,
  Mic,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Spinner,
  inputCls,
} from "../components/ui";
import { completeChat } from "../lib/llm";
import { PROVIDERS, PROVIDER_ORDER } from "../lib/providers";
import { DEFAULT_SYSTEM_PROMPT } from "../lib/prompts";
import { saveSettings, useSettings } from "../lib/settings";
import type { ProviderId, ProviderInfo } from "../lib/types";
import { cn, errMsg } from "../lib/utils";


const SETUP: Record<ProviderId, { description: string; link?: string; label?: string }> = {
  codex: { description: "Подключите установленный Codex. Если потребуется вход, подтвердите его в браузере; модель можно оставить пустой." },
  openai: { description: "Создайте API-ключ в кабинете OpenAI, вставьте его ниже и выберите модель. Доступ к API и его оплата могут отличаться от подписки ChatGPT.", link: "https://platform.openai.com/api-keys", label: "Открыть кабинет OpenAI" },
  anthropic: { description: "Создайте API-ключ Claude в консоли Anthropic, вставьте его ниже и выберите модель. Доступ и оплата API настраиваются в консоли.", link: "https://platform.claude.com/settings/keys", label: "Открыть консоль Claude" },
  gemini: { description: "Создайте ключ Gemini API в Google AI Studio, вставьте его ниже и выберите модель. Доступ и лимиты зависят от проекта.", link: "https://aistudio.google.com/app/apikey", label: "Открыть Google AI Studio" },
  openrouter: { description: "Создайте ключ OpenRouter, вставьте его и укажите модель в формате provider/model. Проверьте баланс и доступ модели.", link: "https://openrouter.ai/settings/keys", label: "Открыть OpenRouter" },
  deepseek: { description: "Создайте ключ в DeepSeek Platform, вставьте его и выберите доступную модель. Проверьте баланс API.", link: "https://platform.deepseek.com/api_keys", label: "Открыть DeepSeek" },
  groq: { description: "Создайте ключ в Groq Console, вставьте его и выберите модель, доступную вашему аккаунту.", link: "https://console.groq.com/keys", label: "Открыть Groq Console" },
  ollama: { description: "Установите и запустите Ollama, скачайте в ней модель и укажите её имя ниже. Ключ для стандартной локальной установки не нужен.", link: "https://ollama.com/download", label: "Скачать Ollama" },
  custom: { description: "Укажите базовый адрес сервера, совместимого с OpenAI Chat Completions, и точное имя модели. Если сервис требует ключ, вставьте его ниже." },
};

function wireLabelFor(wire: ProviderInfo["wire"]): string {
  if (wire === "gemini") return "Gemini API";
  if (wire === "anthropic") return "Anthropic API";
  return "OpenAI-совместимый";
}

type LocalModel = { id: string; modelPath: string; size: number; complete: boolean };
type ProviderModel = { id: string; displayName?: string; description?: string };
const MODEL_LABELS: Record<string, string> = {
  tiny: "Tiny · быстрая", base: "Base · сбалансированная", small: "Small · точнее",
  "tiny.en": "Tiny · английский", "base.en": "Base · английский", "small.en": "Small · английский",
  "small-q5_1": "Small Q5 · компактная", "small.en-q5_1": "Small Q5 · английский",
  "medium-q5_0": "Medium Q5", "medium.en-q5_0": "Medium Q5 · английский", "large-v3-turbo-q5_0": "Large v3 Turbo Q5 · многоязычная",
};
const englishOnly = (id: string) => id.includes(".en");
const samePath = (a: string, b: string) => a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();

export function SettingsPage() {
  const settings = useSettings((s) => s.settings);
  const patch = useSettings((s) => s.patch);
  const patchProvider = useSettings((s) => s.patchProvider);

  const provider = PROVIDERS[settings.activeProvider];
  const cfg = settings.providers[settings.activeProvider];

  const [showKey, setShowKey] = useState(false);
  const [connectingCodex, setConnectingCodex] = useState(false);
  const [codexStatus, setCodexStatus] = useState("");
  const [codexUrl, setCodexUrl] = useState("");
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);
  const [loadingProviderModels, setLoadingProviderModels] = useState(false);
  const [providerModelsMessage, setProviderModelsMessage] = useState("");
  const modelRequest = useRef(0);

  useEffect(() => {
    modelRequest.current += 1;
    setProviderModels([]); setProviderModelsMessage(""); setLoadingProviderModels(false);
    return () => { modelRequest.current += 1; };
  }, [provider.id, cfg.apiKey, cfg.baseUrl]);

  async function loadProviderModels() {
    const request = ++modelRequest.current;
    setLoadingProviderModels(true); setProviderModelsMessage(""); setProviderModels([]);
    try {
      const models = await invoke<ProviderModel[]>("list_provider_models", {
        provider: provider.id, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl || null,
      });
      if (request !== modelRequest.current) return;
      setProviderModels(models);
      if (!models.length) setProviderModelsMessage(tr("Провайдер не вернул модели. Можно указать название вручную."));
    } catch (e) {
      if (request === modelRequest.current) setProviderModelsMessage(`${tr("Не удалось загрузить модели")}: ${errMsg(e)}`);
    } finally {
      if (request === modelRequest.current) setLoadingProviderModels(false);
    }
  }
  async function connectCodex() {
    setConnectingCodex(true); setCodexStatus("Проверяю Codex и состояние входа…"); setCodexUrl(""); setTestResult(null);
    const channel = new Channel<{ type: "browser"; url: string } | { type: "status"; message: string }>();
    channel.onmessage = (event) => {
      if (event.type === "status") setCodexStatus(event.message);
      else { setCodexUrl(event.url); void openUrl(event.url).catch(() => setCodexStatus("Не удалось открыть браузер. Нажмите ссылку для входа ниже.")); }
    };
    try {
      await invoke("connect_codex", { onEvent: channel });
      patch({ activeProvider: "codex" }); await saveSettings();
      setCodexUrl(""); setCodexStatus("Codex подключён и выбран. Отправьте тестовый запрос, чтобы проверить доступ к модели.");
    } catch (e) { setCodexUrl(""); setCodexStatus(`Не удалось подключить Codex: ${errMsg(e)}`); }
    finally { setConnectingCodex(false); }
  }
  const [transcriptionError, setTranscriptionError] = useState("");
  const [transcriptionStatus, setTranscriptionStatus] = useState("");
  const [checkingTranscriber, setCheckingTranscriber] = useState(false);
  const [localModel, setLocalModel] = useState("base");
  const [allModels, setAllModels] = useState(false);
  const [installedModels, setInstalledModels] = useState<LocalModel[]>([]);
  const [managingModel, setManagingModel] = useState(false);
  async function refreshModels() { setInstalledModels(await invoke<LocalModel[]>("list_local_models")); }
  useEffect(() => { void refreshModels().catch((e) => setTranscriptionError(errMsg(e))); }, []);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; downloaded: number; total: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function pickSetting(key: "whisperExecutable" | "whisperModelPath") {
    try {
      const path = await open({ multiple: false });
      if (path && !Array.isArray(path)) { patch({ [key]: path }); setTranscriptionError(""); }
    } catch (e) {
      setTranscriptionError(errMsg(e));
    }
  }

  async function selectInstalledModel(model: LocalModel) {
    if (englishOnly(model.id) && settings.transcriptionLanguage !== "en") { setTranscriptionError("Эта модель поддерживает только английский. Выберите английский язык или многоязычную модель."); return; }
    setManagingModel(true); setTranscriptionError(""); setTranscriptionStatus("");
    try { const result = await invoke<{ executable: string; modelPath: string }>("activate_local_model", { model: model.id }); patch({ transcriptionMode: "local", whisperExecutable: result.executable, whisperModelPath: result.modelPath }); await saveSettings(); setTranscriptionStatus("Модель проверена и выбрана."); }
    catch (e) { setTranscriptionError(errMsg(e)); } finally { setManagingModel(false); }
  }
  async function removeInstalledModel(model: LocalModel) {
    if (!window.confirm(`Удалить модель ${tr(MODEL_LABELS[model.id] || model.id)}? Её можно будет скачать заново.`)) return;
    setManagingModel(true); setTranscriptionError(""); setTranscriptionStatus("");
    try { await invoke("delete_local_model", { modelPath: model.modelPath }); if (samePath(settings.whisperModelPath, model.modelPath)) { patch({ whisperModelPath: "" }); await saveSettings(); } await refreshModels(); setTranscriptionStatus("Модель удалена. Остальные модели и движок сохранены."); }
    catch (e) { setTranscriptionError(errMsg(e)); } finally { setManagingModel(false); }
  }
  async function installModel() {
    setInstalling(true); setTranscriptionError(""); setTranscriptionStatus(""); setProgress(null);
    const channel = new Channel<{ stage: string; downloaded: number; total: number }>();
    channel.onmessage = setProgress;
    try {
      const english = settings.transcriptionLanguage === "en";
      const model = english && localModel !== "large-v3-turbo-q5_0"
        ? localModel.replace(/^(tiny|base|small|medium)/, "$1.en") : localModel;
      const result = await invoke<{ executable: string; modelPath: string }>("install_local_model", { model, onProgress: channel });
      patch({ transcriptionMode: "local", whisperExecutable: result.executable, whisperModelPath: result.modelPath });
      await saveSettings(); await refreshModels();
      setTranscriptionStatus("Модель скачана и применена. Локальное распознавание готово к использованию.");
    } catch (e) { setTranscriptionError(`Не удалось установить модель: ${errMsg(e)}`); }
    finally { setInstalling(false); }
  }
  async function saveTranscriber() {
    setTranscriptionError(""); setTranscriptionStatus("");
    try { await saveSettings(); setTranscriptionStatus("Настройки сохранены и будут использоваться во встречах и интервью."); }
    catch (e) { setTranscriptionError(`Не удалось сохранить настройки: ${errMsg(e)}`); }
  }
  async function checkDeepgram() {
    setTranscriptionError(""); setTranscriptionStatus(""); setCheckingTranscriber(true);
    try {
      await saveSettings();
      await invoke("check_deepgram_key", { apiKey: settings.deepgramKey });
      setTranscriptionStatus("Ключ сохранён; Deepgram подтвердил авторизацию. Доступность модели и баланс проверяются при распознавании.");
    } catch (e) { setTranscriptionError(errMsg(e)); }
    finally { setCheckingTranscriber(false); }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const text = await completeChat({
        provider: settings.activeProvider,
        config: cfg,
        messages: [
          { role: "system", content: "Ты тестовый помощник." },
          { role: "user", content: "Ответь ровно одним словом: ok" },
        ],
      });
      if (!text.trim()) throw new Error("Сервис вернул пустой ответ.");
      setTestResult({ ok: true, text: `Ответ получен: ${text.trim()}` });
    } catch (e) {
      setTestResult({ ok: false, text: errMsg(e) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
        
        <header>
          
          <h1 className="text-[15px] font-semibold tracking-tight">
            {tr("Настройки")}
          </h1>
          
          <p className="text-[11px] text-ink-500">
            {tr("Ключи хранятся локально на этом устройстве")}
          </p>
        
        </header>

        

        <Card>
          
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            
            <KeyRound size={15} className="text-accent-400" />
            {tr("Провайдер и модель")}
          </div>

          

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            
            {PROVIDER_ORDER.map((id) => {
              const info = PROVIDERS[id];
              const active = settings.activeProvider === id;
              return (
                <button
                  key={id}
                  onClick={() => { setTestResult(null); setShowKey(false); patch({ activeProvider: id as ProviderId }); }}
                  disabled={testing}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition",
                    active
                      ? "border-accent-500/50 bg-accent-500/10"
                      : "border-ink-700 bg-ink-900/40 hover:border-ink-600 hover:bg-ink-850/60",
                  )}
                >
                  
                  <div className="flex items-center gap-2">
                    
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: info.color }}
                    />
                    
                    <span className="truncate text-[12px] font-medium text-mist-100">
                      
                      {tr(info.name)}
                    
                    </span>
                  
                  </div>
                  
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    
                    {tr(wireLabelFor(info.wire))}
                  
                  </div>
                
                </button>
              );
            })}
          
          </div>

          

          <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850/60 p-3 text-xs leading-relaxed text-mist-300">
            
            <p>{tr(SETUP[provider.id].description)}</p>
            {provider.id === "codex" && <div className="mt-3 space-y-2">
              <Button variant="primary" disabled={connectingCodex} onClick={() => void connectCodex()}>{connectingCodex ? "Подключаю…" : "Подключить Codex"}</Button>
              {codexStatus && <p role="status">{codexStatus}</p>}
              {codexUrl && <button className="text-accent-400 underline" onClick={() => void openUrl(codexUrl).catch((e) => setCodexStatus(`Не удалось открыть браузер: ${errMsg(e)}`))}>Открыть страницу входа ↗</button>}
            </div>}
            
            
            
            {SETUP[provider.id].link && <button className="mt-2 text-accent-400 underline" onClick={() => void openUrl(SETUP[provider.id].link!).catch((e) => setTestResult({ ok: false, text: errMsg(e) }))}>{tr(SETUP[provider.id].label || "")} ↗</button>}
          
          </div>
          
          <div className="mt-4 grid gap-4">
            
            {provider.id !== "codex" && provider.id !== "ollama" && <Field
              label={tr("API-ключ")}
              hint={provider.requiresKey ? tr("обязателен; хранится в настройках без отдельного шифрования") : tr("если сервер требует")}
            >
              
              <div className="relative">
                
                <input
                  type={showKey ? "text" : "password"}
                  value={cfg.apiKey}
                  onChange={(e) => { setTestResult(null); patchProvider(settings.activeProvider, { apiKey: e.target.value }); }}
                  placeholder={provider.keyHint}
                  className={cn(inputCls, "font-mono w-full pr-10 text-[12px]")}
                />
                
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 transition hover:text-mist-200"
                  title={showKey ? tr("Скрыть") : tr("Показать")}
                >
                  
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                
                </button>
              
              </div>
            
            </Field>}

            

            <Field label={tr("Модель")} hint={tr("можно ввести вручную")}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void loadProviderModels()} disabled={loadingProviderModels}>
                  {loadingProviderModels ? <Spinner size={14} /> : <RefreshCw size={14} />}
                  {tr("Загрузить модели")}
                </Button>
                {providerModels.length > 0 && <span role="status">{tr("Модели загружены")}: {providerModels.length}</span>}
              </div>
              {providerModels.length > 0 && <select
                className={cn(inputCls, "mb-2 w-full")}
                value={providerModels.some((m) => m.id === cfg.model) ? cfg.model : ""}
                onChange={(e) => { if (e.target.value) { setTestResult(null); patchProvider(provider.id, { model: e.target.value }); } }}
                aria-label={tr("Выбрать загруженную модель")}
              >
                <option value="">{tr("Выберите модель из списка")}</option>
                {providerModels.map((m) => <option key={m.id} value={m.id}>{m.displayName && m.displayName !== m.id ? `${m.displayName} (${m.id})` : m.id}</option>)}
              </select>}
              {providerModels.length > 0 && <p className="mb-2 text-ink-500">{tr("Список не гарантирует доступ к модели; проверьте подключение после выбора.")}</p>}
              {providerModelsMessage && <p role="status" className="mb-2 break-words text-amber-300">{providerModelsMessage}</p>}
              
              <input
                list={`settings-models-${provider.id}`}
                value={cfg.model}
                onChange={(e) =>
                  (setTestResult(null), patchProvider(settings.activeProvider, { model: e.target.value }))
                }
                placeholder={provider.defaultModel || "model-id"}
                className={cn(inputCls, "font-mono w-full text-[12px]")}
              />
              
              <datalist id={`settings-models-${provider.id}`}>
                
                {[...new Set([...providerModels.map((m) => m.id), ...provider.models])].map((m) => (
                  <option key={m} value={m} />
                ))}
              
              </datalist>
            
            </Field>

            

            {provider.id !== "codex" && <Field label={tr("Адрес API")} hint={provider.id === "custom" ? tr("Базовый адрес без /chat/completions, например https://example.com/v1") : tr("Обычно изменять не нужно")}>
              
              <input
                value={cfg.baseUrl}
                onChange={(e) =>
                  (setTestResult(null), patchProvider(settings.activeProvider, { baseUrl: e.target.value }))
                }
                placeholder={provider.defaultBaseUrl || "https://…"}
                className={cn(inputCls, "font-mono w-full text-[12px]")}
              />
            
            </Field>}

          

          </div>

          

          <div className="mt-4 flex items-center gap-3">
            
            <Button
              variant="secondary"
              onClick={() => void testConnection()}
              disabled={testing}
            >
              
              {testing ? (
                <Spinner size={14} />
              ) : (
                <RefreshCw size={14} />
              )}
              {tr("Проверить подключение")}
            </Button>
            
            {provider.id !== "codex" && provider.id !== "ollama" && <span className="text-[11px] text-mist-400">{tr("Проверка отправит короткий запрос и может расходовать лимит API.")}</span>}
            
            {testResult && (
              <div
                className={cn(
                  "min-w-0 flex-1 break-words text-[12px]",
                  testResult.ok ? "text-emerald-400" : "text-red-300",
                )}
              >
                
                {testResult.ok ? "✓ " : "✗ "}
                
                {testResult.text}
              
              </div>
            )}
          
          </div>
        
        </Card>

    

    <Card><h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Mic size={15} className="text-accent-400" /> {tr("Транскрибатор")}</h2><div className="grid gap-3">
      
      {transcriptionError && <ErrorBanner text={transcriptionError} onClose={() => setTranscriptionError("")} />}
      
      <Field label={tr("Способ распознавания")}><select className={cn(inputCls, "w-full")} value={settings.transcriptionMode} onChange={(e) => { setTranscriptionStatus(""); setTranscriptionError(""); patch({ transcriptionMode: e.target.value as "api" | "local" | "deepgram" }); }}><option value="api">{tr("API или локальный сервер (OpenAI-совместимый)")}</option><option value="deepgram">Deepgram</option><option value="local">{tr("Локальный whisper.cpp")}</option></select></Field>
      
      <Field label={tr("Язык речи")} hint={tr("Выберите язык для распознавания")}><select className={cn(inputCls, "max-w-64")} value={settings.transcriptionLanguage} disabled={installing} onChange={(e) => patch({ transcriptionLanguage: e.target.value })}><option value="">{tr("Автоопределение")}</option><option value="ru">{tr("Русский")}</option><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="pt">Português</option><option value="it">Italiano</option><option value="uk">Українська</option><option value="tr">Türkçe</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ar">العربية</option></select></Field>
      
      {settings.transcriptionMode === "api" ? <>
        
        <Field label={tr("Адрес API")} hint={tr("для локального сервера укажите его адрес /v1")}><input className={cn(inputCls, "w-full")} value={settings.transcriptionUrl} onChange={(e) => patch({ transcriptionUrl: e.target.value })} /></Field>
        
        <div className="grid gap-3 md:grid-cols-2"><Field label={tr("Модель")}><input className={cn(inputCls, "w-full")} value={settings.transcriptionModel} onChange={(e) => patch({ transcriptionModel: e.target.value })} /></Field><Field label={tr("API-ключ")}><input type="password" className={cn(inputCls, "w-full")} value={settings.transcriptionKey} onChange={(e) => patch({ transcriptionKey: e.target.value })} /></Field></div>
      
      </> : settings.transcriptionMode === "deepgram" ? <>
        
        <p className="text-xs text-mist-400">{tr("Deepgram получит аудиозапись для распознавания. Адрес сервиса настроен автоматически.")}</p>
        
        <div className="grid gap-3 md:grid-cols-2"><Field label={tr("Модель Deepgram")} hint={tr("nova-3 поддерживает русский")}><input className={cn(inputCls, "w-full")} value={settings.deepgramModel} onChange={(e) => { setTranscriptionStatus(""); patch({ deepgramModel: e.target.value }); }} /></Field><Field label={tr("API-ключ Deepgram")}><input type="password" className={cn(inputCls, "w-full")} value={settings.deepgramKey} onChange={(e) => { setTranscriptionStatus(""); setTranscriptionError(""); patch({ deepgramKey: e.target.value }); }} /></Field></div>
      
      </> : <><p className="text-xs text-mist-400">{tr("Локальная модель работает на компьютере. Для английского доступны специализированные модели; Large v3 Turbo подходит для разных языков.")}</p>
        
        <Field label={tr("Модель")}><select className={cn(inputCls, "w-full")} value={localModel} disabled={installing} onChange={(e) => setLocalModel(e.target.value)}><option value="tiny">{tr("Быстрая · около 75 МБ · ниже точность")}</option><option value="base">{tr("Сбалансированная · около 141 МБ")}</option><option value="small">{tr("Более точная · около 465 МБ · медленнее")}</option><option value="small-q5_1">{tr("Small Q5 · около 181 МиБ · компактная")}</option><option value="medium-q5_0">{tr("Medium Q5 · около 514 МиБ")}</option><option value="large-v3-turbo-q5_0">{tr("Large v3 Turbo Q5 · около 547 МиБ · многоязычная")}</option>{allModels && <optgroup label={tr("Все модели")}><option value="base-q5_1">BASE Q5_1 · 57 MiB</option><option value="base-q8_0">BASE Q8_0 · 78 MiB</option><option value="large-v1">LARGE V1 · 2951 MiB</option><option value="large-v2-q5_0">LARGE V2 Q5_0 · 1031 MiB</option><option value="large-v2-q8_0">LARGE V2 Q8_0 · 1579 MiB</option><option value="large-v2">LARGE V2 · 2951 MiB</option><option value="large-v3-q5_0">LARGE V3 Q5_0 · 1031 MiB</option><option value="large-v3-turbo-q8_0">LARGE V3 TURBO Q8_0 · 834 MiB</option><option value="large-v3-turbo">LARGE V3 TURBO · 1549 MiB</option><option value="large-v3">LARGE V3 · 2952 MiB</option><option value="medium-q8_0">MEDIUM Q8_0 · 785 MiB</option><option value="medium">MEDIUM · 1463 MiB</option><option value="small-q8_0">SMALL Q8_0 · 252 MiB</option><option value="tiny-q5_1">TINY Q5_1 · 31 MiB</option><option value="tiny-q8_0">TINY Q8_0 · 42 MiB</option></optgroup>}</select></Field>
        <label className="flex items-center gap-2 text-xs text-mist-400"><input type="checkbox" checked={allModels} onChange={(e) => { setAllModels(e.target.checked); if (!e.target.checked) setLocalModel("base"); }} />{tr("Показать все модели")}</label>
        <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={installing || managingModel} onClick={() => void installModel()}>{installing ? tr("Устанавливаю…") : tr("Скачать и применить")}</Button></div>
        
        <div className="rounded-lg border border-ink-700 p-3"><h3 className="text-sm font-semibold">{tr("Скачанные модели")}</h3>
          
          {installedModels.length === 0 ? <p className="mt-2 text-xs text-mist-400">{tr("Моделей пока нет. Загрузите одну из списка выше.")}</p> : <div className="mt-2 space-y-2">{installedModels.map((model) => {
            const active = samePath(settings.whisperModelPath, model.modelPath);
            const incompatible = englishOnly(model.id) && settings.transcriptionLanguage !== "en";
            return <div key={model.id} className="flex flex-wrap items-center gap-2 border-t border-ink-700 pt-2"><div className="min-w-0 flex-1"><div className="text-xs text-mist-200">{tr(MODEL_LABELS[model.id] || model.id)}{active ? tr(" · выбрана") : ""}</div><div className="text-[11px] text-mist-400">{(model.size / 1048576).toFixed(0)} {tr("МиБ")}{!model.complete ? tr(" · файл неполный, скачайте заново") : incompatible ? tr(" · только для английского") : ""}</div></div><Button disabled={installing || managingModel || active || incompatible || !model.complete} onClick={() => void selectInstalledModel(model)}>{tr("Выбрать")}</Button><Button disabled={installing || managingModel} onClick={() => void removeInstalledModel(model)}>{tr("Удалить")}</Button></div>;
          })}</div>}
        
        </div>
        
        {settings.whisperModelPath && /\.en(?:-q[0-9_]+)?\.bin$/i.test(settings.whisperModelPath) && settings.transcriptionLanguage !== "en" && <p className="text-xs text-red-300">{tr("Текущая модель поддерживает только английский. Выберите английский язык или многоязычную модель.")}</p>}
        
        {installing && progress && <div className="text-xs text-mist-300" role="status">{progress.stage === "engine" ? tr("Движок") : tr("Модель")}: {Math.round(progress.downloaded / progress.total * 100)}%<progress className="ml-2" max={progress.total} value={progress.downloaded} /></div>}
        
        <p className="text-xs text-mist-400">{tr("Можно также указать установленные файлы вручную:")}</p>
        
        <Field label={tr("Программа whisper-cli")}><div className="flex gap-2"><input className={cn(inputCls, "w-full")} value={settings.whisperExecutable} onChange={(e) => patch({ whisperExecutable: e.target.value })} /><Button onClick={() => void pickSetting("whisperExecutable")}>{tr("Выбрать")}</Button></div></Field>
        
        <Field label={tr("Файл модели")}><div className="flex gap-2"><input className={cn(inputCls, "w-full")} value={settings.whisperModelPath} onChange={(e) => patch({ whisperModelPath: e.target.value })} /><Button onClick={() => void pickSetting("whisperModelPath")}>{tr("Выбрать")}</Button></div></Field></>}
      
      <div className="flex flex-wrap items-center gap-2"><Button variant="primary" onClick={() => void saveTranscriber()}>{tr("Сохранить настройки")}</Button>{settings.transcriptionMode === "deepgram" && <Button disabled={checkingTranscriber} onClick={() => void checkDeepgram()}>{checkingTranscriber ? tr("Проверяю…") : tr("Сохранить и проверить ключ")}</Button>}</div>
      
      {transcriptionStatus && <p role="status" className="text-xs text-emerald-400">{tr(transcriptionStatus)}</p>}
      
      <p className="text-xs text-mist-400">{tr("Изменения также сохраняются автоматически. Эта настройка общая для интервью и встреч.")}</p>
    
    </div></Card>

        

        <Card>
          
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            
            <Cpu size={15} className="text-accent-400" />
            {tr("CLI-агенты")}
          </div>
          
          <p className="mb-4 text-[12px] leading-relaxed text-mist-400">
            {tr("Для автономного решения задач нужны установленные CLI (Claude Code или Codex). Используйте плейсхолдер")}{" "}
            
            <code className="font-mono text-accent-400">{"{prompt}"}</code> {tr("— он будет заменён на текст вопроса.")}
          </p>
          
          <div className="grid gap-4">
            
            <Field label="Claude Code" hint="claude -p {prompt}">
              
              <input
                value={settings.claudeCommand}
                onChange={(e) => patch({ claudeCommand: e.target.value })}
                className={cn(inputCls, "font-mono w-full text-[12px]")}
              />
            
            </Field>
            
            <Field label="Codex" hint="codex exec {prompt}">
              
              <input
                value={settings.codexCommand}
                onChange={(e) => patch({ codexCommand: e.target.value })}
                className={cn(inputCls, "font-mono w-full text-[12px]")}
              />
            
            </Field>
          
          </div>
        
        </Card>

        

        <Card>
          
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            
            <Keyboard size={15} className="text-accent-400" />
            {tr("Интерфейс")}
          </div>
          
          <div className="grid gap-4">
            
            <Field label="Язык интерфейса / Interface language / Idioma de la interfaz">
              
              <select aria-label="Язык интерфейса / Interface language / Idioma de la interfaz" className={cn(inputCls, "w-full")} value={settings.uiLanguage} onChange={(e) => patch({ uiLanguage: e.target.value as "ru" | "en" | "es" })}>
                
                <option value="ru">{tr("Русский")}</option><option value="en">English</option><option value="es">Español</option>
              
              </select>
            
            </Field>
            
            <Field label={tr("Тема оформления")}>
              
              <select className={cn(inputCls, "w-full")} value={settings.theme} onChange={(e) => patch({ theme: e.target.value as "light" | "dark" })}>
                
                <option value="light">{tr("Светлая")}</option><option value="dark">{tr("Тёмная")}</option>
              
              </select>
            
            </Field>
            
            <details className="rounded-lg border border-ink-700 p-3"><summary className="cursor-pointer text-sm text-mist-200">{tr("Дополнительно: базовая инструкция помощника")}</summary>
              
              <p className="mt-2 text-xs text-mist-400">{tr("Отправляется вместе с каждым вопросом скрытому помощнику. Пожелания и резюме на странице «Собеседование» добавляются отдельно; избегайте противоречий.")}</p>
              
              <textarea aria-label={tr("Базовая инструкция помощника")} value={settings.systemPrompt} onChange={(e) => patch({ systemPrompt: e.target.value })} className={cn(inputCls, "mt-3 min-h-44 w-full resize-y text-[12px]")} />
              
              <Button className="mt-2" onClick={() => patch({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}>{tr("Восстановить стандартную инструкцию")}</Button>
            
            </details>
          
          </div>
        
        </Card>

        

        <Card>
          
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            
            <ShieldCheck size={15} className="text-emerald-400" />
            {tr("Приватность и данные")}
          </div>
          
          <ul className="space-y-2 text-[12px] leading-relaxed text-mist-400">
            
            <li>
              {tr("• API-ключи и настройки хранятся")}{" "}
              
              <span className="text-mist-200">{tr("локально")}</span> {tr("в каталоге данных приложения. Никакого собственного сервера нет — запросы идут напрямую выбранному провайдеру.")}
            </li>
            
            <li>
              {tr("• Ключи сохраняются в локальном JSON без шифрования. Не храните чужие ключи и не демонстрируйте экран настроек при трансляции.")}
            </li>
            
            <li>
              {tr("• Резюме и вакансии не покидают устройство, кроме как при отправке в выбранную вами модель.")}
            </li>
          
          </ul>
          
          <div className="mt-3 flex flex-wrap gap-2">
            
            <Badge tone="accent">open source</Badge>
            
            <Badge tone="neutral">{tr("локальное хранение")}</Badge>
            
            <Badge tone="neutral">{tr("без своего сервера")}</Badge>
          
          </div>
        
        </Card>
      
      </div>
    
    </div>
  );
}
