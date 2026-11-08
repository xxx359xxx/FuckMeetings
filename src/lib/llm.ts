import { Channel, invoke } from "@tauri-apps/api/core";
import type { ChatMessage, LlmEvent, ProviderConfig, ProviderId } from "./types";

export interface StreamHandle {
  promise: Promise<string>;
  cancel: () => void;
}

export function streamChat(opts: {
  provider: ProviderId;
  config: ProviderConfig;
  messages: ChatMessage[];
  onDelta: (text: string) => void;
}): StreamHandle {
  if (opts.provider !== "codex" && !opts.config.model.trim()) {
    return { promise: Promise.reject(new Error("Укажите модель в настройках провайдера.")), cancel: () => {} };
  }
  if (opts.provider === "custom" && !opts.config.baseUrl.trim()) {
    return { promise: Promise.reject(new Error("Укажите адрес API своего сервера в настройках.")), cancel: () => {} };
  }
  if (opts.provider !== "codex" && opts.config.baseUrl.trim()) {
    try { const url = new URL(opts.config.baseUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
    catch { return { promise: Promise.reject(new Error("Адрес API должен начинаться с http:// или https://")), cancel: () => {} }; }
  }
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const channel = new Channel<LlmEvent>();
  let full = "";
  let settled = false;
  let resolveFn: (v: string) => void = () => {};
  let rejectFn: (e: Error) => void = () => {};

  const promise = new Promise<string>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const settle = (fn: () => void) => {
    if (!settled) {
      settled = true;
      fn();
    }
  };

  channel.onmessage = (e) => {
    if (e.type === "delta") {
      full += e.text;
      opts.onDelta(e.text);
    } else if (e.type === "done") {
      if (!(e.text || full).trim()) settle(() => rejectFn(new Error("Сервис вернул пустой ответ. Проверьте модель и доступ к ней.")));
      else settle(() => resolveFn(e.text || full));
    } else if (e.type === "error") {
      settle(() => rejectFn(new Error(e.message)));
    }
  };

  invoke("llm_chat", {
    provider: opts.provider,
    model: opts.config.model,
    apiKey: opts.config.apiKey,
    baseUrl: opts.config.baseUrl || null,
    messages: opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images ?? [],
    })),
    requestId,
    onEvent: channel,
  }).catch((err) =>
    settle(() =>
      rejectFn(err instanceof Error ? err : new Error(String(err))),
    ),
  );

  return {
    promise,
    cancel: () => {
      invoke("llm_cancel", { requestId }).catch(() => {});
      settle(() => rejectFn(new Error("Генерация отменена")));
    },
  };
}

export async function completeChat(opts: {
  provider: ProviderId;
  config: ProviderConfig;
  messages: ChatMessage[];
  onDelta?: (text: string) => void;
}): Promise<string> {
  const handle = streamChat({
    provider: opts.provider,
    config: opts.config,
    messages: opts.messages,
    onDelta: opts.onDelta ?? (() => {}),
  });
  return handle.promise;
}
