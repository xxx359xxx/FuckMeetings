import { tr } from "../lib/i18n";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  FileText,
  BookOpen,
  Keyboard,
  MessageSquare,
  Mic,
  Sun,
  Moon,
  Settings as SettingsIcon,
} from "lucide-react";
import { PROVIDERS } from "../lib/providers";
import { hotkeyLabel, toggleOverlay, useHotkey } from "../lib/overlay";
import type { Settings } from "../lib/types";
import { cn } from "../lib/utils";
import { useSettings } from "../lib/settings";

export type Tab = "interview" | "practice" | "resume" | "meetings" | "settings" | "shortcuts";

const NAV: {
  id: Tab;
  label: string;
  hint: string;
  icon: typeof MessageSquare;
}[] = [
  {
    id: "interview",
    label: "Собеседование",
    hint: "Резюме и инструкции",
    icon: MessageSquare,
  },
  { id: "practice", label: "Тренировка", hint: "Вопросы и ответы", icon: BookOpen },
  {
    id: "resume",
    label: "Резюме / ATS",
    hint: "Адаптация под вакансию",
    icon: FileText,
  },
  { id: "meetings", label: "Встречи", hint: "Запись и итоги", icon: Mic },
  { id: "shortcuts", label: "Горячие клавиши", hint: "Управление помощником", icon: Keyboard },
  {
    id: "settings",
    label: "Настройки",
    hint: "Ключи, модели, агенты",
    icon: SettingsIcon,
  },
];

export function Sidebar({
  tab,
  onTab,
  settings,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  settings: Settings;
}) {
  const provider = PROVIDERS[settings.activeProvider];
  const providerCfg = settings.providers[settings.activeProvider];
  const hotkey = useHotkey();
  const patch = useSettings((s) => s.patch);
  const [version, setVersion] = useState("");

  useEffect(() => {
    let active = true;
    void getVersion().then((value) => {
      if (active) setVersion(value);
    }).catch((error) => console.warn("Не удалось получить версию приложения:", error));
    return () => { active = false; };
  }, []);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      
      <div className="flex items-center gap-2.5 px-5 py-5">
        
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent-500/15 text-accent-400 ring-1 ring-accent-500/30">
          
          <img src="/fuckmeetings-logo.png" alt="" className="h-9 w-9 rounded-lg" />
        
        </div>
        
        <div>
          
          <div className="text-sm font-semibold tracking-tight">
            FuckMeetings {version && <span className="text-[10px] text-mist-400">v{version}</span>}
          
          </div>
          
          <div className="text-[9px] tracking-wider text-ink-500">{tr("ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО")}</div>
        
        </div>
      
      </div>

      

      <nav className="flex flex-col gap-1 px-3">
        
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTab(item.id)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                active
                  ? "bg-accent-500/12 text-mist-100 ring-1 ring-accent-500/25"
                  : "text-mist-400 hover:bg-ink-800/70 hover:text-mist-100",
              )}
            >
              
              <Icon
                size={17}
                className={
                  active
                    ? "text-accent-400"
                    : "text-ink-500 group-hover:text-mist-300"
                }
              />
              
              <span className="min-w-0 flex-1">
                
                <span className="block text-[14px] font-medium">
                  
                  {tr(item.label)}
                
                </span>
                
                <span className="block truncate text-[11px] text-ink-500">
                  
                  {tr(item.hint)}
                
                </span>
              
              </span>
            
            </button>
          );
        })}
      
      </nav>

      

      <div className="mt-auto p-3">
        
        <button onClick={() => patch({ theme: settings.theme === "dark" ? "light" : "dark" })} className="mb-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-mist-400 transition hover:bg-ink-800 hover:text-mist-100" aria-label={settings.theme === "dark" ? tr("Включить светлую тему") : tr("Включить тёмную тему")}>
          
          {settings.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          
          {settings.theme === "dark" ? tr("Светлая тема") : tr("Тёмная тема")}
        
        </button>
        
        <button
          onClick={() => void toggleOverlay()}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-accent-500/25 bg-accent-500/10 px-3 py-2 text-left transition hover:bg-accent-500/15"
        >
          
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-glow" />
          
          <span className="min-w-0 flex-1">
            
            <span className="block text-[12px] font-medium text-mist-100">
              {tr("Показать оверлей")}
            </span>
            
            <span className="block truncate text-[10.5px] text-ink-500">
              
              {hotkey.status === "error"
                ? tr("хоткей занят · нажмите кнопку")
                : `${hotkeyLabel(settings.shortcuts.show)} · поверх всех окон`}
            
            </span>
          
          </span>
        
        </button>
        
        {hotkey.status === "error" ? (
          <div className="mb-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-300">
            {tr("Горячая клавиша недоступна:")} {hotkey.error}
          
          </div>
        ) : null}
        
        <div className="rounded-xl border border-ink-700 bg-ink-850/70 p-3">
          
          <div className="flex items-center gap-2">
            
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: provider.color }}
            />
            
            <span className="truncate text-[12px] font-medium text-mist-200">
              
              {tr(provider.name)}
            
            </span>
          
          </div>
          
          <div className="mt-1 truncate text-[11px] text-ink-500">
            
            {providerCfg.model || tr("модель не выбрана")}
          
          </div>
        
        </div>
      
      </div>
    
    </aside>
  );
}
