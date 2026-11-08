import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { emitTo } from "@tauri-apps/api/event";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ShortcutAction, Shortcuts } from "./types";

export const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);
export const LEGACY_SHORTCUTS: Shortcuts = {
  show: "Control+Shift+O", clickThrough: "Control+Shift+Space", send: "Control+Shift+Enter",
  screen: "Control+Shift+S", region: "Control+Shift+R",
  up: "Control+Shift+Up", down: "Control+Shift+Down", left: "Control+Shift+Left", right: "Control+Shift+Right",
};
export const DEFAULT_SHORTCUTS: Shortcuts = IS_MAC
  ? Object.fromEntries(Object.entries(LEGACY_SHORTCUTS).map(([action, key]) => [action, key.replace(/^Control\+/, "Super+")])) as Shortcuts
  : { ...LEGACY_SHORTCUTS };
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  show: "Показать или скрыть помощника", clickThrough: "Включить или выключить сквозные клики", send: "Отправить распознанный вопрос",
  screen: "Отправить снимок всего экрана", region: "Отправить выбранную область",
  up: "Переместить окно вверх", down: "Переместить окно вниз", left: "Переместить окно влево", right: "Переместить окно вправо",
};
export const SHORTCUT_ACTIONS = Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[];
export type HotkeyState = { status: "idle" | "ok" | "error"; hotkey: string; error: string; errors: Partial<Record<ShortcutAction, string>> };
export const useHotkey = create<HotkeyState>(() => ({ status: "idle", hotkey: "", error: "", errors: {} }));
export async function getOverlayWindow(): Promise<WebviewWindow | null> { return WebviewWindow.getByLabel("overlay"); }
export async function toggleOverlay(): Promise<void> {
  const overlay = await getOverlayWindow(); if (!overlay) return;
  if (await overlay.isVisible()) await overlay.hide(); else { await overlay.show(); await overlay.setFocus(); }
}
export function hotkeyLabel(key: string): string { return key.replace(/CommandOrControl|CmdOrCtrl/gi, IS_MAC ? "Cmd" : "Ctrl").replace(/Super|Command|Meta/gi, IS_MAC ? "Cmd" : "Win").replace(/Control/gi, "Ctrl").replace(/\+/g, " + "); }
export function normalizeShortcut(key: string): string { return key.replace(/CommandOrControl|CmdOrCtrl/gi, IS_MAC ? "Super" : "Control").replace(/Command|Cmd|Meta/gi, "Super").replace(/Ctrl/gi, "Control").replace(/\s/g, "").toLowerCase(); }
let registered: Partial<Record<ShortcutAction, string>> = {};
let desired: Shortcuts = { ...DEFAULT_SHORTCUTS };
let paused = false;
let clickThrough = false;
let chain: Promise<void> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn); chain = next.then(() => {}, () => {}); return next;
}
let capturing = false;
async function captureAndSend(region: boolean) {
  if (capturing) return; capturing = true;
  const overlay = await getOverlayWindow();
  try {
    const wasVisible = await overlay?.isVisible();
    await emitTo("overlay", "capture-in-progress", true);
    if (wasVisible) await overlay?.hide();
    await new Promise((resolve) => setTimeout(resolve, 220));
    let image: string;
    try { image = await invoke<string>("capture_screen"); }
    finally { if (wasVisible) await overlay?.show(); await emitTo("overlay", "capture-in-progress", false); }
    if (region) {
      await invoke("open_selection");
      await emitTo("selection", "selection-open");
    } else {
      if (!wasVisible) await overlay?.show();
      await emitTo("overlay", "overlay-screen-send", image);
      await invoke("clear_pending_capture");
    }
  } catch (e) {
    await emitTo("overlay", "overlay-screen-error", e instanceof Error ? e.message : String(e));
    await overlay?.show();
  } finally { capturing = false; }
}
export async function act(action: ShortcutAction) {
  if (action === "screen" || action === "region") return captureAndSend(action === "region");
  if (action === "show") return toggleOverlay();
  if (action === "send") return emitTo("overlay", "overlay-send");
  const window = await getOverlayWindow(); if (!window) return;
  if (action === "clickThrough") {
    await window.setIgnoreCursorEvents(!clickThrough); clickThrough = !clickThrough;
    await emitTo("overlay", "overlay-click-through", clickThrough); return;
  }
  const position = await window.outerPosition();
  const [dx, dy] = action === "up" ? [0, -30] : action === "down" ? [0, 30] : action === "left" ? [-30, 0] : [30, 0];
  await window.setPosition(new PhysicalPosition(position.x + dx, position.y + dy));
}
async function clearRegistered() {
  for (const action of SHORTCUT_ACTIONS) {
    const key = registered[action]; if (!key) continue;
    try { await unregister(key); delete registered[action]; }
    catch (e) { console.error("Не удалось освободить сочетание:", e); }
  }
}
async function registerAll(keys: Shortcuts): Promise<Partial<Record<ShortcutAction, string>>> {
  const errors: Partial<Record<ShortcutAction, string>> = {};
  for (const action of SHORTCUT_ACTIONS) {
    if (registered[action] === keys[action]) continue;
    if (registered[action]) { errors[action] = "Не удалось освободить предыдущее сочетание."; continue; }
    try { await register(keys[action], (event) => { if (event.state === "Pressed") void act(action).catch(console.error); }); registered[action] = keys[action]; }
    catch (e) { errors[action] = e instanceof Error ? e.message : String(e); }
  }
  const error = errors.show || "";
  useHotkey.setState({ status: error ? "error" : "ok", hotkey: keys.show, error, errors });
  return errors;
}
export function applyShortcuts(keys: Shortcuts): Promise<void> {
  return serial(async () => {
    desired = { ...keys }; if (paused) return;
    if (SHORTCUT_ACTIONS.every((a) => registered[a] === keys[a])) return;
    await clearRegistered(); await registerAll(desired);
  });
}
export function pauseShortcutCapture(): Promise<void> {
  return serial(async () => {
    paused = true;
    await clearRegistered();
    if (Object.keys(registered).length) {
      paused = false;
      await registerAll(desired);
      throw new Error("Не удалось временно отключить сочетания. Попробуйте снова.");
    }
  });
}
export function finishShortcutCapture(action?: ShortcutAction, key?: string): Promise<{ ok: boolean; error?: string }> {
  return serial(async () => {
    const next = { ...desired };
    if (action && key) {
      const duplicate = SHORTCUT_ACTIONS.find((a) => a !== action && normalizeShortcut(next[a]) === normalizeShortcut(key));
      if (duplicate) { paused = false; await registerAll(desired); return { ok: false, error: `Это сочетание уже используется: ${SHORTCUT_LABELS[duplicate]}.` }; }
      next[action] = key;
    }
    paused = false;
    const errors = await registerAll(next);
    if (action && errors[action]) {
      await clearRegistered(); await registerAll(desired);
      return { ok: false, error: `Не удалось назначить сочетание: ${errors[action]}. Возможно, оно занято другой программой.` };
    }
    desired = next;
    return { ok: true };
  });
}
