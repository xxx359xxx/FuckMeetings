import { create } from "zustand";
import { load, type Store } from "@tauri-apps/plugin-store";
import { PROVIDERS, PROVIDER_ORDER } from "./providers";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import { DEFAULT_SHORTCUTS, IS_MAC, LEGACY_SHORTCUTS, SHORTCUT_ACTIONS } from "./overlay";
import type { ProviderConfig, ProviderId, Settings } from "./types";

export function makeDefaultSettings(): Settings {
  const providers = {} as Record<ProviderId, ProviderConfig>;
  for (const id of PROVIDER_ORDER) {
    providers[id] = {
      apiKey: "",
      baseUrl: PROVIDERS[id].defaultBaseUrl,
      model: PROVIDERS[id].defaultModel,
    };
  }
  return {
    theme: "light",
    uiLanguage: "ru",
    activeProvider: "openai",
    providers,
    claudeCommand: "claude -p {prompt}",
    codexCommand: "codex exec --skip-git-repo-check {prompt}",
    overlayHotkey: "CommandOrControl+Shift+O",
    shortcuts: { ...DEFAULT_SHORTCUTS },
    transcriptionMode: "api",
    deepgramKey: "",
    deepgramModel: "nova-3",
    whisperExecutable: "",
    whisperModelPath: "",
    whisperModelsDir: "",
    transcriptionUrl: "https://api.openai.com/v1",
    transcriptionKey: "",
    transcriptionModel: "gpt-transcribe",
    transcriptionLanguage: "ru",
    temperature: 0.4,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    interviewResume: "",
    interviewResumeName: "",
    interviewInstructions: "",
    interviewContextEnabled: true,
  };
}

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("settings.json", { autoSave: 150 });
  }
  return storePromise;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch === undefined ? base : (patch as T));
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const b = (base as Record<string, unknown>)[key];
    const p = patch[key];
    out[key] = isPlainObject(b) && isPlainObject(p) ? deepMerge(b, p) : p;
  }
  return out as T;
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  setSettings: (s: Settings) => void;
  patch: (p: Partial<Settings>) => void;
  patchProvider: (id: ProviderId, p: Partial<ProviderConfig>) => void;
  setLoaded: (b: boolean) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: makeDefaultSettings(),
  loaded: false,
  setSettings: (s) => set({ settings: s }),
  patch: (p) => set({ settings: { ...get().settings, ...p } }),
  patchProvider: (id, p) =>
    set({
      settings: {
        ...get().settings,
        providers: {
          ...get().settings.providers,
          [id]: { ...get().settings.providers[id], ...p },
        },
      },
    }),
  setLoaded: (b) => set({ loaded: b }),
}));

let listening = false;
let applyingRemote = false;
export async function initSettings(): Promise<void> {
  try {
    const st = await getStore();
    if (!listening) {
      listening = true;
      await st.onKeyChange<Settings>("settings", (value) => {
        if (!value || JSON.stringify(value) === JSON.stringify(useSettings.getState().settings)) return;
        applyingRemote = true;
        useSettings.setState({ settings: deepMerge(makeDefaultSettings(), value) });
        applyingRemote = false;
      });
    }
    const saved = await st.get<Settings>("settings");
    if (saved && typeof saved === "object") {
      const merged = deepMerge(makeDefaultSettings(), saved);
      if (/^(CommandOrControl|CmdOrCtrl|Control|Ctrl)\+Shift\+Space$/i.test(merged.overlayHotkey)) merged.overlayHotkey = "CommandOrControl+Shift+O";
      if (!saved.shortcuts && merged.overlayHotkey) merged.shortcuts.show = merged.overlayHotkey;
      // Upgrade only the old built-in bindings; preserve customized shortcuts.
      if (IS_MAC && saved.shortcuts) for (const action of SHORTCUT_ACTIONS) {
        if (saved.shortcuts[action] === LEGACY_SHORTCUTS[action]) merged.shortcuts[action] = DEFAULT_SHORTCUTS[action];
      }
      useSettings.setState({ settings: merged });
    }
  } catch (err) {
    console.error("Не удалось загрузить настройки:", err);
  }
  useSettings.setState({ loaded: true });
}

let persistBound = false;
function bindPersist(): void {
  if (persistBound) return;
  persistBound = true;
  useSettings.subscribe((state, previous) => {
    // Becoming ready is not a settings edit. Other windows may have loaded an
    // older snapshot, which must not overwrite a user's newly saved shortcuts.
    if (!state.loaded || applyingRemote || state.settings === previous.settings) return;
    getStore()
      .then((st) => st.set("settings", state.settings))
      .catch((err) => console.error("Не удалось сохранить настройки:", err));
  });
}
bindPersist();

export async function saveSettings(): Promise<void> {
  const st = await getStore();
  await st.set("settings", useSettings.getState().settings);
  await st.save();
}

export function activeProviderConfig(settings: Settings): ProviderConfig {
  return settings.providers[settings.activeProvider];
}
