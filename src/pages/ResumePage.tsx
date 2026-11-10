import { tr } from "../lib/i18n";
import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  CircleCheck,
  CircleX,
  Download,
  FileText,
  KeyRound,
  Sparkles,
  Upload,
  Wand,
} from "lucide-react";
import { Markdown } from "../components/Markdown";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  ErrorBanner,
  Field,
  Spinner,
  inputCls,
} from "../components/ui";
import { completeChat } from "../lib/llm";
import {
  ATS_ANALYSIS_PROMPT,
  ATS_ANALYSIS_SYSTEM,
  TAILOR_PROMPT,
  TAILOR_SYSTEM,
} from "../lib/prompts";
import { PROVIDERS, PROVIDER_ORDER } from "../lib/providers";
import { buildResumePdf } from "../lib/pdf";
import {
  buildResumeDocx,
  extractResumeText,
  readFileBytes,
  writeFileBytes,
} from "../lib/resume";
import { useSettings } from "../lib/settings";
import type { AtsAnalysis, ProviderId, TailoredResume } from "../lib/types";
import { cn, errMsg, extractJson } from "../lib/utils";

function scoreColor(score: number): string {
  if (score >= 75) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

function parseAnalysis(text: string): AtsAnalysis | null {
  try {
    const a = extractJson<AtsAnalysis>(text);
    if (typeof a?.matchScore !== "number") return null;
    return {
      matchScore: a.matchScore,
      verdict: typeof a.verdict === "string" ? a.verdict : "",
      matchedKeywords: Array.isArray(a.matchedKeywords) ? a.matchedKeywords.filter((x): x is string => typeof x === "string") : [],
      missingKeywords: Array.isArray(a.missingKeywords) ? a.missingKeywords.filter((x): x is string => typeof x === "string") : [],
      filters: Array.isArray(a.filters) ? a.filters.filter((x) => x && typeof x.name === "string").map((x) => ({ name: x.name, present: x.present === true, note: typeof x.note === "string" ? x.note : "" })) : [],
      recommendations: Array.isArray(a.recommendations) ? a.recommendations.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return null;
  }
}

function parseTailored(text: string): TailoredResume | null {
  const markdown = text.trim();
  if (!markdown) return null;
  const title = markdown.match(/^#{1,2}\s+(.+)$/m)?.[1] || "Резюме";
  return { title, summary: "", skills: [], experience: [], education: [], markdown };
}

export function ResumePage({
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

  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState<string | null>(null);
  const [vacancy, setVacancy] = useState("");
  const [resumeLanguage, setResumeLanguage] = useState("original");
  const [resumeGoal, setResumeGoal] = useState("vacancy");
  const [resumeStyle, setResumeStyle] = useState("concise");
  const [inventExperience, setInventExperience] = useState(false);
  const [additionalExperience, setAdditionalExperience] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null);
  const [analysisRaw, setAnalysisRaw] = useState<string | null>(null);
  const [tailored, setTailored] = useState<TailoredResume | null>(null);
  const [tailorRaw, setTailorRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyze" | "tailor" | "letter" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  async function loadResume() {
    try {
      const picked = await open({
        multiple: false,
        title: "Выберите резюме",
        filters: [
          { name: "Резюме", extensions: ["pdf", "docx", "txt", "md"] },
        ],
      });
      if (!picked || Array.isArray(picked)) return;
      const bytes = await readFileBytes(picked);
      const text = await extractResumeText(picked, bytes);
      if (!text.trim()) {
        setError("Не удалось извлечь текст из файла. Вставьте резюме вручную.");
        return;
      }
      setResumeText(text);
      setResumeName(picked.split(/[\\/]/).pop() ?? picked);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function analyze() {
    if (!resumeText.trim()) {
      setError("Сначала загрузите или вставьте резюме.");
      return;
    }
    if (!vacancy.trim()) {
      setError("Вставьте текст вакансии.");
      return;
    }
    setBusy("analyze");
    setError(null);
    setAnalysis(null);
    setAnalysisRaw(null);
    try {
      let partial = "";
      const text = await completeChat({
        onDelta: (chunk) => { partial += chunk; setAnalysisRaw(partial); },
        provider: settings.activeProvider,
        config: cfg,
        messages: [
          { role: "system", content: ATS_ANALYSIS_SYSTEM },
          {
            role: "user",
            content: `${ATS_ANALYSIS_PROMPT}\n\n=== РЕЗЮМЕ ===\n${resumeText}\n\n=== ВАКАНСИЯ ===\n${vacancy}`,
          },
        ],
      });
      const parsed = parseAnalysis(text);
      if (parsed) { setAnalysis(parsed); setAnalysisRaw(null); }
      else setAnalysisRaw(text);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function tailor() {
    if (!resumeText.trim()) {
      setError("Сначала загрузите или вставьте резюме.");
      return;
    }
    if (resumeGoal === "vacancy" && !vacancy.trim()) {
      setError("Вставьте текст вакансии.");
      return;
    }
    setBusy("tailor");
    setError(null);
    setTailored(null);
    setTailorRaw(null);
    setSavedPath(null);
    try {
      let partial = "";
      const text = await completeChat({
        onDelta: (chunk) => { partial += chunk; setTailorRaw(partial); },
        provider: settings.activeProvider,
        config: cfg,
        messages: [
          { role: "system", content: inventExperience ? "Верни полный текст резюме в Markdown, сохрани контактные данные и исходные сведения." : TAILOR_SYSTEM },
          {
            role: "user",
            content: `${(resumeGoal === "improve" ? TAILOR_PROMPT.replace("На основе исходного резюме и текста вакансии перепиши резюме так, чтобы оно максимально проходило ATS-фильтры этой вакансии.", "На основе исходного резюме улучши его ясность и структуру без привязки к вакансии.") : TAILOR_PROMPT).replace(inventExperience ? "- НЕ выдумывай факты, компании, даты, проекты, навыки, которых не было в исходном резюме." : "", inventExperience ? "- Можно предложить дополнительные правдоподобные обязанности в существующих местах работы; помечай каждое такое дополнение как [проверить]. Не выдумывай компании, даты и образование." : "").replace(inventExperience ? "Не добавляй навыки, которых не было, но можешь честно сгруппировать смежные" : "", inventExperience ? "Не добавляй неподтверждённые навыки, но можешь сгруппировать смежные" : "").replace(inventExperience ? "Не добавляй вымышленных фактов." : "", "").replace("Язык — тот же, что в исходном резюме (обычно русский или английский).", "Язык результата: " + ({ original: "как в исходном резюме", ru: "русский", en: "английский", es: "испанский" }[resumeLanguage] || "как в исходном резюме") + ".")}\n\nЦель: ${resumeGoal === "vacancy" ? "адаптация под вакансию" : "улучшение исходного резюме без привязки к вакансии"}. Стиль: ${resumeStyle === "concise" ? "краткий" : "подробный"}. ${inventExperience ? "Стремись повысить соответствие вакансии и ориентируйся на оценку 80+, но не обещай конкретный балл. Используй релевантные ключевые слова и добавь в существующие места работы подходящие обязанности на основе контекста резюме, вакансии и дополнительного опыта. Дополнения, которые явно не подтверждены исходными данными, помечай [проверить]; не придумывай цифры и результаты." : "Строго не выдумывай опыт, навыки, цифры и другие факты."}\n\n=== РЕЗЮМЕ ===\n${resumeText}\n\n=== ДОПОЛНИТЕЛЬНЫЙ ОПЫТ КАНДИДАТА ===\n${additionalExperience || "Не указан"}\n\n=== ВАКАНСИЯ ===\n${vacancy}`,
          },
        ],
      });
      const parsed = parseTailored(text);
      if (parsed) { setTailored(parsed); setTailorRaw(null); }
      else setTailorRaw(text);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function generateCoverLetter() {
    if (!resumeText.trim()) {
      setError("Сначала загрузите или вставьте резюме.");
      return;
    }
    setBusy("letter");
    setError(null);
    setCoverLetter("");
    try {
      let partial = "";
      const text = await completeChat({
        provider: settings.activeProvider,
        config: cfg,
        onDelta: (chunk) => { partial += chunk; setCoverLetter(partial); },
        messages: [
          { role: "system", content: "Напиши готовое сопроводительное письмо в Markdown. Опирайся только на подтверждённые сильные стороны исходного резюме; не выдумывай факты. Верни только текст письма." },
          { role: "user", content: `Язык: ${{ original: "как в исходном резюме", ru: "русский", en: "английский", es: "испанский" }[resumeLanguage] || "как в исходном резюме"}. ${vacancy.trim() ? "Адаптируй письмо к вакансии." : "Напиши универсальное письмо."}\n\n=== РЕЗЮМЕ ===\n${resumeText}\n\n=== ВАКАНСИЯ ===\n${vacancy}` },
        ],
      });
      setCoverLetter(text);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function downloadDocx() {
    if (!tailored) return;
    try {
      const bytes = await buildResumeDocx(tailored);
      const safe =
        (tailored.title || "resume")
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "resume";
      const path = await save({
        title: "Сохранить резюме",
        defaultPath: `${safe}.docx`,
        filters: [{ name: "Word (DOCX)", extensions: ["docx"] }],
      });
      if (!path) return;
      await writeFileBytes(path, bytes);
      setSavedPath(path);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function downloadPdf() {
    if (!tailored) return;
    try {
      const bytes = await buildResumePdf(tailored);
      const safe =
        (tailored.title || "resume")
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "resume";
      const path = await save({
        title: "Сохранить резюме как PDF",
        defaultPath: `${safe}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      await writeFileBytes(path, bytes);
      setSavedPath(path);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function downloadMarkdown() {
    if (!tailorRaw) return;
    try {
      const path = await save({
        title: "Сохранить как Markdown",
        defaultPath: "resume.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await writeFileBytes(path, new TextEncoder().encode(tailorRaw));
      setSavedPath(path);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const hasResult =
    analysis || analysisRaw || tailored || tailorRaw || coverLetter || busy;

  return (
    <div className="flex h-full flex-col">
      
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-800 px-6 py-3">
        
        <div className="mr-auto">
          
          <h1 className="text-xl font-semibold tracking-tight">
            {tr("Резюме / ATS")}
          </h1>
          
          <p className="text-[12px] text-ink-500">
            {tr("Анализ фильтров ATS и адаптация резюме под вакансию")}
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
          list={`resume-models-${provider.id}`}
          value={cfg.model}
          onChange={(e) =>
            patchProvider(settings.activeProvider, { model: e.target.value })
          }
          placeholder={provider.defaultModel || "model-id"}
          className={cn(inputCls, "w-56 py-1.5 font-mono text-[12px]")}
        />
        
        <datalist id={`resume-models-${provider.id}`}>
          
          {provider.models.map((m) => (
            <option key={m} value={m} />
          ))}
        
        </datalist>
      
      </header>

      

      <div className="shrink-0 px-5 pt-4">
        
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-3">
          
          {[
            { title: tr("Резюме"), done: !!resumeText.trim() },
            { title: tr("Вакансия"), done: !!vacancy.trim() },
            { title: tr("Анализ ATS"), done: !!analysis },
            { title: tr("Адаптация"), done: !!tailored },
          ].map((step, i) => <div key={step.title} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5">
            
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold", step.done ? "bg-accent-500 text-white" : "bg-ink-800 text-ink-500")}>{step.done ? "✓" : i + 1}</span>
            
            <span className="truncate text-xs font-medium text-mist-200">{step.title}</span>
          
          </div>)}
        
        </div>
      
      </div>
      
      <div className="flex min-h-0 flex-1">
        
        <div className="flex w-[42%] min-w-[340px] flex-col gap-4 overflow-y-auto border-r border-ink-800 p-5">
          
          {missingKey && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
              
              <KeyRound size={14} className="shrink-0" />
              
              <span className="min-w-0 flex-1">
                {tr("Для")} {provider.name} {tr("не задан API-ключ.")}
              </span>
              
              <button
                onClick={onOpenSettings}
                className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-200"
              >
                {tr("Настроить")}
              </button>
            
            </div>
          )}

          

          <div className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
            
            <div className="mb-2 flex items-center justify-between">
              
              <span className="text-[12px] font-medium text-mist-200">
                {tr("Резюме")}
              </span>
              
              {resumeName && (
                <span className="max-w-[55%] truncate text-[11px] text-ink-500">
                  
                  {resumeName}
                
                </span>
              )}
            
            </div>
            
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void loadResume()}
            >
              
              <Upload size={14} /> {tr("Загрузить PDF / DOCX")}
            </Button>
            
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder={tr("…или вставьте текст резюме сюда")}
              className={cn(
                inputCls,
                "font-mono mt-2 h-40 w-full resize-none text-[12px]",
              )}
            />
          
          </div>

          

          <Field label={tr("Вакансия")} hint={tr("текст описания")}>
            
            <textarea
              value={vacancy}
              onChange={(e) => setVacancy(e.target.value)}
              placeholder={tr("Вставьте текст вакансии…")}
              className={cn(inputCls, "h-48 w-full resize-none")}
            />
          
          </Field>

          

          <div className="space-y-2 rounded-xl border border-ink-700 p-3">
            <Field label={tr("Цель резюме")}><select className={cn(inputCls, "w-full")} value={resumeGoal} onChange={(e) => setResumeGoal(e.target.value)}><option value="vacancy">{tr("Под вакансию")}</option><option value="improve">{tr("Улучшить резюме")}</option></select></Field>
            <Field label={tr("Язык резюме")}><select className={cn(inputCls, "w-full")} value={resumeLanguage} onChange={(e) => setResumeLanguage(e.target.value)}><option value="original">{tr("Как в исходном резюме")}</option><option value="ru">Русский</option><option value="en">English</option><option value="es">Español</option></select></Field>
            <details><summary className="cursor-pointer text-xs text-mist-300">{tr("Дополнительные настройки")}</summary><Field label={tr("Подробность")}><select className={cn(inputCls, "w-full")} value={resumeStyle} onChange={(e) => setResumeStyle(e.target.value)}><option value="concise">{tr("Кратко")}</option><option value="detailed">{tr("Подробно")}</option></select></Field><label className="mt-3 flex items-start gap-2 text-xs text-mist-300"><input type="checkbox" checked={inventExperience} onChange={(e) => setInventExperience(e.target.checked)} /><span>{tr("Дополнить опыт под вакансию")}</span></label>{inventExperience && <p className="mt-2 text-xs text-mist-400">{tr("Модель предложит подходящие обязанности в существующих местах работы. Неподтверждённые дополнения будут помечены [проверить]. Оценка 80+ не гарантируется.")}</p>}</details>
          </div>
          <Field label={tr("Неуказанный опыт")} hint={tr("необязательно")}><textarea value={additionalExperience} onChange={(e) => setAdditionalExperience(e.target.value)} placeholder={tr("Расскажите, чем ещё занимались и в какой компании — модель учтёт это при адаптации") } className={cn(inputCls, "h-24 w-full resize-none")} /></Field>
          {error && <ErrorBanner text={error} onClose={() => setError(null)} />}

          

          <div className="flex flex-col gap-2">
            
            <Button
              variant="primary"
              onClick={() => void analyze()}
              disabled={busy !== null}
            >
              
              <Sparkles size={15} />
              
              {busy === "analyze" ? tr("Анализирую…") : tr("Анализ ATS")}
            
            </Button>
            
            <Button
              variant="secondary"
              onClick={() => void tailor()}
              disabled={busy !== null}
            >
              
              <Wand size={15} />
              
              {busy === "tailor" ? tr("Адаптирую…") : tr("Адаптировать резюме")}
            
            </Button>
          
            <Button variant="secondary" onClick={() => void generateCoverLetter()} disabled={busy !== null}><FileText size={15} />{busy === "letter" ? tr("Пишу письмо…") : tr("Создать сопроводительное письмо")}</Button>
          </div>
        
        </div>

        

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          
          {busy && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-accent-500/25 bg-accent-500/8 px-3 py-2 text-[12px] text-accent-400">
              
              <Spinner size={14} />
              
              {busy === "analyze"
                ? tr("Модель оценивает резюме под ATS-фильтры вакансии…")
                : busy === "letter" ? tr("Модель пишет сопроводительное письмо…") : tr("Модель переписывает резюме под вакансию…")}
            
            </div>
          )}

          

          {!hasResult && (
            <div className="grid h-full place-items-center">
              
              <div className="max-w-md text-center">
                
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-500/12 text-accent-400 ring-1 ring-accent-500/25">
                  
                  <FileText size={24} />
                
                </div>
                
                <h3 className="text-base font-semibold">
                  {tr("Проверка резюме на ATS")}
                </h3>
                
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist-400">
                  {tr("Загрузите резюме и вставьте текст вакансии. Приложение найдёт ATS-фильтры (навыки, опыт, образование, ключевые слова) и поможет адаптировать резюме для автоматического отбора. Оценка ориентировочная: правила конкретной ATS могут отличаться.")}
                </p>
                
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  
                  <Badge tone="accent">{tr("оценка совпадения")}</Badge>
                  
                  <Badge tone="neutral">{tr("ключевые слова")}</Badge>
                  
                  <Badge tone="neutral">{tr("экспорт DOCX")}</Badge>
                
                </div>
              
              </div>
            
            </div>
          )}

          

          {analysis && (
            <Card className="mb-4">
              
              <div className="flex items-center gap-5">
                
                <div
                  className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(${scoreColor(analysis.matchScore)} ${Math.max(
                      0,
                      Math.min(100, analysis.matchScore),
                    ) * 3.6}deg, #1b2634 0deg)`,
                  }}
                >
                  
                  <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-ink-900">
                    
                    <div className="text-center">
                      
                      <div
                        className="text-xl font-semibold"
                        style={{ color: scoreColor(analysis.matchScore) }}
                      >
                        
                        {Math.round(analysis.matchScore)}
                      
                      </div>
                      
                      <div className="text-[10px] text-ink-500">{tr("из 100")}</div>
                    
                    </div>
                  
                  </div>
                
                </div>
                
                <div className="min-w-0">
                  
                  <div className="text-[13px] font-semibold">
                    {tr("Совпадение с вакансией")}
                  </div>
                  
                  <p className="mt-1 text-[13px] leading-relaxed text-mist-400">
                    
                    {analysis.verdict}
                  
                  </p>
                
                </div>
              
              </div>

              

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                
                <KeywordList
                  title={tr("Есть в резюме")}
                  tone="green"
                  items={analysis.matchedKeywords}
                />
                
                <KeywordList
                  title={tr("Не хватает")}
                  tone="red"
                  items={analysis.missingKeywords}
                />
              
              </div>

              

              {analysis.filters.length > 0 && (
                <div className="mt-4">
                  
                  <div className="mb-2 text-[12px] font-medium text-mist-200">
                    {tr("ATS-фильтры")}
                  </div>
                  
                  <div className="flex flex-col divide-y divide-ink-800 rounded-lg border border-ink-700">
                    
                    {analysis.filters.map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5 px-3 py-2">
                        
                        {f.present ? (
                          <CircleCheck
                            size={15}
                            className="mt-0.5 shrink-0 text-emerald-400"
                          />
                        ) : (
                          <CircleX
                            size={15}
                            className="mt-0.5 shrink-0 text-red-400"
                          />
                        )}
                        
                        <div className="min-w-0">
                          
                          <div className="text-[12px] font-medium text-mist-200">
                            
                            {f.name}
                          
                          </div>
                          
                          {f.note && (
                            <div className="text-[11px] leading-relaxed text-ink-500">
                              
                              {f.note}
                            
                            </div>
                          )}
                        
                        </div>
                      
                      </div>
                    ))}
                  
                  </div>
                
                </div>
              )}

              

              {analysis.recommendations.length > 0 && (
                <div className="mt-4">
                  
                  <div className="mb-2 text-[12px] font-medium text-mist-200">
                    {tr("Рекомендации")}
                  </div>
                  
                  <ul className="list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-mist-400">
                    
                    {analysis.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  
                  </ul>
                
                </div>
              )}
            
            </Card>
          )}

          

          {analysisRaw && (
            <Card className="mb-4">
              
              <div className="mb-2 text-[13px] font-semibold">
                {tr("Ответ модели (идёт обработка или JSON не разобран)")}
              </div>
              
              <pre className="font-mono max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-950 p-3 text-[12px] leading-relaxed text-mist-300">
                
                {analysisRaw}
              
              </pre>
            
            </Card>
          )}

          

          {coverLetter && (
            <Card className="mb-4">
              <div className="flex items-center justify-between gap-3"><div className="text-[13px] font-semibold">{tr("Сопроводительное письмо")}</div><CopyButton text={coverLetter} /></div>
              <div className="mt-3 rounded-lg border border-ink-700 bg-ink-950/60 p-4"><Markdown>{coverLetter}</Markdown></div>
            </Card>
          )}

          {tailored && (
            <Card>
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                <div className="text-[13px] font-semibold">
                  {tr("Готовое резюме")}
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  
                  <CopyButton text={tailored.markdown} />
                  
                  <Button
                    variant="secondary"
                    onClick={() => void downloadPdf()}
                  >
                    
                    <Download size={14} /> {tr("Скачать PDF")}
                  </Button>
                  
                  <Button
                    variant="primary"
                    onClick={() => void downloadDocx()}
                  >
                    
                    <Download size={14} /> {tr("Скачать DOCX")}
                  </Button>
                
                </div>
              
              </div>
              
              {savedPath && (
                <div className="mt-2 text-[11px] text-emerald-400">
                  {tr("Сохранено:")} {savedPath}
                
                </div>
              )}
              
              <div className="mt-3 rounded-lg border border-ink-700 bg-ink-950/60 p-4">
                
                <Markdown>{tailored.markdown}</Markdown>
              
              </div>
            
            </Card>
          )}

          

          {tailorRaw && (
            <Card>
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                <div className="text-[13px] font-semibold">
                  {tr("Ответ модели (идёт обработка или JSON не разобран)")}
                </div>
                
                <Button
                  variant="secondary"
                  onClick={() => void downloadMarkdown()}
                >
                  
                  <Download size={14} /> {tr("Скачать .md")}
                </Button>
              
              </div>
              
              {savedPath && (
                <div className="mt-2 text-[11px] text-emerald-400">
                  {tr("Сохранено:")} {savedPath}
                
                </div>
              )}
              
              <pre className="font-mono mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-950 p-3 text-[12px] leading-relaxed text-mist-300">
                
                {tailorRaw}
              
              </pre>
            
            </Card>
          )}
        
        </div>
      
      </div>
    
    </div>
  );
}

function KeywordList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "red";
}) {
  return (
    <div>
      
      <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-mist-200">
        
        <span>{title}</span>
        
        <span className="text-ink-500">{items.length}</span>
      
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        
        {items.length === 0 ? (
          <span className="text-[11px] text-ink-500">—</span>
        ) : (
          items.map((k, i) => (
            <span
              key={i}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px]",
                tone === "green"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/25 bg-red-500/10 text-red-300",
              )}
            >
              
              {k}
            
            </span>
          ))
        )}
      
      </div>
    
    </div>
  );
}
