import { tr } from "../lib/i18n";
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FileText, Sparkles } from "lucide-react";
import { Button, Card, ErrorBanner, Field, inputCls } from "../components/ui";
import { extractResumeText, readFileBytes } from "../lib/resume";
import { saveSettings, useSettings } from "../lib/settings";
import { cn, errMsg } from "../lib/utils";

export function InterviewContextPage() {
  const settings = useSettings((state) => state.settings);
  const patch = useSettings((state) => state.patch);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  async function loadResume() {
    try {
      const path = await open({ multiple: false, title: "Выберите резюме", filters: [{ name: "Резюме", extensions: ["pdf", "docx", "txt", "md"] }] });
      if (!path || Array.isArray(path)) return;
      setLoading(true); setError(""); setStatus("");
      const text = await extractResumeText(path, await readFileBytes(path));
      if (!text.trim()) throw new Error("Не удалось извлечь текст. Если PDF состоит из изображений, вставьте текст вручную.");
      patch({ interviewResume: text, interviewResumeName: path.split(/[\\/]/).pop() || path });
      await saveSettings(); setStatus("Резюме загружено. Проверьте извлечённый текст ниже.");
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  async function save() {
    try { await saveSettings(); setError(""); setStatus("Настройки сохранены."); } catch (e) { setError(errMsg(e)); }
  }
  return <div className="h-full overflow-y-auto"><div className="mx-auto max-w-5xl space-y-5 p-6">
    
    <header><h1 className="text-xl font-semibold text-mist-100">{tr("Подготовка к собеседованию")}</h1><p className="mt-1 text-sm text-mist-400">{tr("Добавьте свой опыт и пожелания, чтобы помощник учитывал их в ответах.")}</p></header>
    
    {error && <ErrorBanner text={error} onClose={() => setError("")} />}
    
    {status && <p role="status" className="text-sm text-emerald-400">{tr(status)}</p>}
    
    <Card><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><FileText size={17} /> {tr("Ваше резюме")}</h2><p className="mt-1 text-xs text-mist-400">{tr("PDF, DOCX или текстовый файл. Текст можно проверить и исправить.")}</p></div><Button onClick={() => void loadResume()} disabled={loading}>{loading ? tr("Читаю…") : tr("Загрузить резюме")}</Button></div>
      
      {settings.interviewResumeName && <p className="mb-2 text-xs text-mist-300">{tr("Файл:")} {settings.interviewResumeName}</p>}
      
      <textarea aria-label={tr("Текст резюме")} className={cn(inputCls, "min-h-60 w-full resize-y")} value={settings.interviewResume} placeholder={tr("Загрузите файл или вставьте текст резюме сюда…")} onChange={(e) => { patch({ interviewResume: e.target.value }); setStatus(""); }} />
      
      <div className="mt-2 flex justify-end"><Button disabled={!settings.interviewResume && !settings.interviewResumeName} onClick={() => { patch({ interviewResume: "", interviewResumeName: "" }); setStatus("Резюме удалено из настроек."); }}>{tr("Очистить резюме")}</Button></div>
    
    </Card>
    
    <Card><h2 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Sparkles size={17} /> {tr("Как отвечать")}</h2><p className="mb-3 text-xs text-mist-400">{tr("Опишите стиль, роль или формат ответа. Например: «Отвечай кратко, как системный аналитик, и приводи примеры из моего опыта».")}</p>
      
      <Field label={tr("Пожелания к помощнику")}><textarea className={cn(inputCls, "min-h-32 w-full resize-y")} value={settings.interviewInstructions} onChange={(e) => { patch({ interviewInstructions: e.target.value }); setStatus(""); }} placeholder={tr("Например: сначала краткий ответ, затем пример…")} /></Field>
    
    </Card>
    
    <Card><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={settings.interviewContextEnabled} onChange={(e) => patch({ interviewContextEnabled: e.target.checked })} /><span><strong>{tr("Использовать в скрытом помощнике")}</strong><span className="mt-1 block text-xs text-mist-400">{tr("При каждом запросе текст резюме и пожелания передаются выбранной модели. Данные хранятся в настройках на этом компьютере; при использовании облачной модели они отправляются её провайдеру.")}</span></span></label>
      
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="primary" onClick={() => void save()}>{tr("Сохранить")}</Button><span className="text-xs text-mist-400">{tr("Изменения также сохраняются автоматически.")}</span></div>
    
    </Card>
  
  </div></div>;
}
