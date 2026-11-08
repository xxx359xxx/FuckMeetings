import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ImagePlus,
  KeyRound,
  Sparkles,
  Square,
  Terminal,
  Trash,
} from "lucide-react";
import { SpeechCapture } from "../components/SpeechCapture";
import { Markdown } from "../components/Markdown";
import {
  Badge,
  Button,
  CopyButton,
  ErrorBanner,
  Field,
  Spinner,
  inputCls,
} from "../components/ui";
import { runAgent } from "../lib/agents";
import { streamChat } from "../lib/llm";
import { PROVIDERS, PROVIDER_ORDER } from "../lib/providers";
import { bytesToBase64, readFileBytes } from "../lib/resume";
import { useSettings } from "../lib/settings";
import type { AgentEvent, ChatMessage, ProviderId } from "../lib/types";
import { cn, errMsg } from "../lib/utils";

function mimeFromPath(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function InterviewPage({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const settings = useSettings((s) => s.settings);
  const patch = useSettings((s) => s.patch);
  const patchProvider = useSettings((s) => s.patchProvider);

  const provider = PROVIDERS[settings.activeProvider];
  const cfg = settings.providers[settings.activeProvider];
  const missingKey = provider.requiresKey && !cfg.apiKey.trim();

  const [question, setQuestion] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentKind, setAgentKind] = useState<"claude" | "codex">("claude");
  const [agentLines, setAgentLines] = useState<string[]>([]);

  const streamRef = useRef<{ cancel: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function addFiles(files: File[]) {
    try {
      const urls = await Promise.all(files.map(fileToDataUrl));
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void addFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickImages() {
    try {
      const picked = await open({
        multiple: true,
        title: "Выберите изображения",
        filters: [
          { name: "Изображения", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
        ],
      });
      const paths =
        picked == null ? [] : Array.isArray(picked) ? picked : [picked];
      const urls: string[] = [];
      for (const p of paths) {
        const bytes = await readFileBytes(p);
        urls.push(`data:${mimeFromPath(p)};base64,${bytesToBase64(bytes)}`);
      }
      if (urls.length) setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) void addFiles(files);
  }

  async function ask() {
    const text = question.trim();
    const imgs = images;
    if (!text && imgs.length === 0) return;

    setError(null);
    const userMsg: ChatMessage = {
      role: "user",
      content: text || "Реши задачу, показанную на изображении.",
      images: imgs,
    };
    const assistant: ChatMessage = { role: "assistant", content: "", images: [] };
    setMessages((prev) => [...prev, userMsg, assistant]);
    setQuestion("");
    setImages([]);
    setBusy(true);

    const handle = streamChat({
      provider: settings.activeProvider,
      config: cfg,
      messages: [
        { role: "system", content: settings.systemPrompt, images: [] },
        ...messages,
        userMsg,
      ],
      onDelta: (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + delta };
          }
          return copy;
        });
      },
    });
    streamRef.current = handle;

    try {
      const full = await handle.promise;
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: full };
        }
        return copy;
      });
    } catch (e) {
      const message = errMsg(e);
      if (message !== "Генерация отменена") setError(message);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && !last.content) copy.pop();
        return copy;
      });
    } finally {
      streamRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    streamRef.current?.cancel();
  }

  function newChat() {
    streamRef.current?.cancel();
    streamRef.current = null;
    setMessages([]);
    setQuestion("");
    setImages([]);
    setAgentLines([]);
    setError(null);
    setBusy(false);
  }

  function lastUserText(): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && messages[i].content.trim()) {
        return messages[i].content.trim();
      }
    }
    return "";
  }

  async function agent(kind: "claude" | "codex") {
    const q = question.trim() || lastUserText();
    if (!q) {
      setError("Опишите вопрос текстом — CLI-агенты не принимают изображения.");
      return;
    }
    setError(null);
    setAgentBusy(true);
    setAgentKind(kind);
    setAgentLines([]);

    const command =
      kind === "claude" ? settings.claudeCommand : settings.codexCommand;
    try {
      await runAgent({
        kind,
        prompt: q,
        command,
        workdir: undefined,
        onEvent: (e: AgentEvent) => {
          if (e.type === "stdout") setAgentLines((prev) => [...prev, e.line]);
          else if (e.type === "stderr")
            setAgentLines((prev) => [...prev, `⚠ ${e.line}`]);
          else if (e.type === "exit")
            setAgentLines((prev) => [
              ...prev,
              `— процесс завершён, код ${e.code ?? "?"} —`,
            ]);
          else if (e.type === "error") {
            setAgentLines((prev) => [...prev, `✖ ${e.message}`]);
            setError(e.message);
          }
        },
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setAgentBusy(false);
    }
  }

  const canAsk = question.trim().length > 0 || images.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-800 px-6 py-3">
        <div className="mr-auto">
          <h1 className="text-[15px] font-semibold tracking-tight">
            Собеседование
          </h1>
          <p className="text-[11px] text-ink-500">
            Скрытый помощник: скриншот → ответ с кодом
          </p>
        </div>
        <select
          value={settings.activeProvider}
          onChange={(e) => patch({ activeProvider: e.target.value as ProviderId })}
          className={cn(inputCls, "w-auto py-1.5 text-[12px]")}
        >
          {PROVIDER_ORDER.map((id) => (
            <option key={id} value={id}>
              {PROVIDERS[id].name}
            </option>
          ))}
        </select>
        <input
          list={`models-${provider.id}`}
          value={cfg.model}
          onChange={(e) =>
            patchProvider(settings.activeProvider, { model: e.target.value })
          }
          placeholder={provider.defaultModel || "model-id"}
          className={cn(inputCls, "w-56 py-1.5 font-mono text-[12px]")}
        />
        <datalist id={`models-${provider.id}`}>
          {provider.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[44%] min-w-[340px] flex-col gap-4 overflow-y-auto border-r border-ink-800 p-5">
          {missingKey && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
              <KeyRound size={14} className="shrink-0" />
              <span className="min-w-0 flex-1">
                Для {provider.name} не задан API-ключ.
              </span>
              <button
                onClick={onOpenSettings}
                className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-200"
              >
                Настроить
              </button>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Вопрос</h2>
              <Badge tone="neutral">скриншот · текст</Badge>
            </div>
            <div
              onClick={() => !busy && void pickImages()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className={cn(
                "group cursor-pointer rounded-xl border border-dashed border-ink-600 bg-ink-900/50 px-4 py-5 text-center transition hover:border-accent-500/60 hover:bg-ink-850/60",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <ImagePlus
                className="mx-auto mb-2 text-ink-500 transition group-hover:text-accent-400"
                size={22}
              />
              <div className="text-[13px] font-medium text-mist-200">
                Вставьте скриншот или перетащите файл
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                Ctrl+V · PNG, JPG, WebP · или нажмите, чтобы выбрать
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {images.map((src, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={src}
                      alt={`Вложение ${i + 1}`}
                      className="h-16 w-16 rounded-lg border border-ink-600 object-cover"
                    />
                    <button
                      onClick={() =>
                        setImages((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-ink-600 bg-ink-900 text-mist-300 transition hover:text-red-300"
                      title="Убрать"
                    >
                      <Trash size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SpeechCapture onText={(text) => setQuestion((current) => current ? `${current.trimEnd()} ${text}` : text)} />
          <Field label="Текст вопроса" hint="если есть">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canAsk) {
                  e.preventDefault();
                  void ask();
                }
              }}
              placeholder="Вставьте текст вопроса или задачи…"
              className={cn(inputCls, "h-36 w-full resize-none")}
            />
          </Field>

          {error && <ErrorBanner text={error} onClose={() => setError(null)} />}

          <div className="flex items-center gap-2">
            {busy ? (
              <Button variant="secondary" onClick={stop} className="flex-1">
                <Square size={15} /> Остановить
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void ask()}
                disabled={!canAsk}
                className="flex-1"
              >
                <Sparkles size={15} /> Решить
              </Button>
            )}
            <Button variant="ghost" onClick={newChat} title="Новый чат">
              <Trash size={15} />
            </Button>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-mist-200">
              <Terminal size={14} className="text-ink-500" /> CLI-агенты
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busy || agentBusy}
                onClick={() => void agent("claude")}
              >
                {agentBusy && agentKind === "claude" ? (
                  <Spinner size={14} />
                ) : (
                  <Terminal size={14} />
                )}
                Claude Code
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busy || agentBusy}
                onClick={() => void agent("codex")}
              >
                {agentBusy && agentKind === "codex" ? (
                  <Spinner size={14} />
                ) : (
                  <Terminal size={14} />
                )}
                Codex
              </Button>
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-ink-500">
              Используют установленные у вас CLI и ваши подписки. Команды
              настраиваются в «Настройках».
            </div>
            {agentLines.length > 0 && (
              <pre className="font-mono mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-950 p-2 text-[11px] leading-relaxed text-mist-300">
                {agentLines.join("\n")}
              </pre>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-500/12 text-accent-400 ring-1 ring-accent-500/25">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-base font-semibold">Готов к вопросам</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist-400">
                  Вставьте скриншот вопроса или задачи (
                  <kbd className="rounded border border-ink-600 bg-ink-800 px-1 font-mono text-[11px]">
                    Ctrl
                  </kbd>
                  +
                  <kbd className="rounded border border-ink-600 bg-ink-800 px-1 font-mono text-[11px]">
                    V
                  </kbd>
                  ), перетащите файл или введите текст. Модель даст ответ с
                  кодом и объяснением.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Badge tone="accent">скриншоты</Badge>
                  <Badge tone="neutral">код</Badge>
                  <Badge tone="neutral">объяснения</Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%]">
                    <div className="mb-1 text-right text-[11px] font-medium uppercase tracking-wide text-ink-500">
                      Вы
                    </div>
                    {m.images && m.images.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
                        {m.images.map((src, j) => (
                          <img
                            key={j}
                            src={src}
                            alt={`Вложение ${j + 1}`}
                            className="h-16 w-16 rounded-lg border border-ink-600 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    {m.content && (
                      <div className="rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-[13px] leading-relaxed text-mist-200">
                        {m.content}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="max-w-full rounded-xl border border-ink-700 bg-ink-900/60 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-500">
                        Ответ
                        {busy &&
                          i === messages.length - 1 &&
                          m.content !== "" && (
                            <Badge tone="accent">
                              <Spinner size={10} /> генерация
                            </Badge>
                          )}
                      </div>
                      {m.content && <CopyButton text={m.content} />}
                    </div>
                    {m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-[13px] text-ink-500">
                        <Spinner size={14} /> Думает…
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
