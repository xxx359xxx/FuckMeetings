import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sidebar, type Tab } from "./components/Sidebar";
import { Spinner } from "./components/ui";
import { act, applyShortcuts } from "./lib/overlay";
import { initSettings, useSettings } from "./lib/settings";
import { MeetingsPage } from "./pages/MeetingsPage";
import { InterviewContextPage } from "./pages/InterviewContextPage";
import { OverlayPage } from "./pages/OverlayPage";
import { ResumePage } from "./pages/ResumePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShortcutsPage } from "./pages/ShortcutsPage";
import { MeetingControl } from "./pages/MeetingControl";
import { ScreenSelectionPage } from "./pages/ScreenSelectionPage";
import { UpdateBanner } from "./components/UpdateBanner";

const WINDOW_LABEL = getCurrentWindow().label;
const IS_OVERLAY = WINDOW_LABEL === "overlay";
const IS_SELECTION = WINDOW_LABEL === "selection";
const IS_MEETING_CONTROL = WINDOW_LABEL === "meeting-control";
if (IS_MEETING_CONTROL) document.documentElement.dataset.window = "meeting-control";

export default function App() {
  const [tab, setTab] = useState<Tab>("interview");
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);

  useEffect(() => {
    void initSettings();
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.uiLanguage;
    document.documentElement.dataset.theme = settings.theme === "dark" ? "dark" : "light";
    document.documentElement.style.colorScheme = settings.theme === "dark" ? "dark" : "light";
  }, [settings.theme, settings.uiLanguage]);

  // Only the main window owns the global shortcut; the overlay just gets shown.
  useEffect(() => {
    if (!loaded || IS_OVERLAY || IS_SELECTION || IS_MEETING_CONTROL) return;
    void applyShortcuts(settings.shortcuts);
  }, [loaded, settings.shortcuts]);

  useEffect(() => {
    if (IS_OVERLAY || IS_SELECTION || IS_MEETING_CONTROL) return;
    let disposed = false; const cleanups: (() => void)[] = [];
    void listen("overlay-toggle-click-through", () => { void act("clickThrough"); }).then((fn) => { if (disposed) fn(); else cleanups.push(fn); });
    for (const event of ["meeting-open", "meeting-stop"]) {
      void listen(event, () => setTab("meetings")).then((fn) => { if (disposed) fn(); else cleanups.push(fn); });
    }
    return () => { disposed = true; cleanups.forEach((fn) => fn()); };
  }, []);
  if (IS_SELECTION) return <ScreenSelectionPage />;
  if (IS_MEETING_CONTROL) return <MeetingControl />;

  if (!loaded) {
    return (
      <div
        className={`grid h-full place-items-center ${
          IS_OVERLAY ? "bg-transparent" : "bg-ink-950"
        }`}
      >
        <div className="flex items-center gap-3 text-sm text-mist-400">
          <Spinner size={18} /> Загрузка FuckMeetings…
        </div>
      </div>
    );
  }

  if (IS_OVERLAY) {
    return <OverlayPage />;
  }

  return (
    <div className="flex h-full">
      <Sidebar tab={tab} onTab={setTab} settings={settings} />
      <main className="flex min-w-0 flex-1 flex-col">
        <UpdateBanner />
        <div className="min-h-0 flex-1">
        {tab === "interview" && (
          <InterviewContextPage />
        )}
        {tab === "resume" && (
          <ResumePage onOpenSettings={() => setTab("settings")} />
        )}
        <div className={tab === "meetings" ? "h-full" : "hidden"}><MeetingsPage onOpenSettings={() => setTab("settings")} /></div>
        {tab === "settings" && <SettingsPage />}
        {tab === "shortcuts" && <ShortcutsPage />}
        </div>
      </main>
    </div>
  );
}

