import type { AnswerLanguage } from "../components/PracticeCodeEditor";
import type { PracticeAnalysis } from "./practice-ai";
import { load, type Store } from "@tauri-apps/plugin-store";

export interface Question { id: string; text: string }
export interface QuestionSet { id: string; title: string; questions: Question[]; updatedAt: string }
export interface PracticeAnswer { question: Question; text: string; skipped: boolean; review: boolean }
export interface PracticeSession {
  id: string; title: string; role: string; vacancy: string; resume: string;
  interviewType: "technical" | "recruiter" | "mixed";
  difficulty: "easy" | "medium" | "hard";
  questions: Question[]; answers: PracticeAnswer[]; position: number;
  status: "active" | "completed"; createdAt: string; updatedAt: string;
  feedback?: PracticeAnalysis;
  draftAnswer?: string; answerLanguage?: AnswerLanguage;
}
export interface PracticeSetupDraft {
  title: string; role: string; vacancy: string; resume: string; resumeName: string;
  interviewType: PracticeSession["interviewType"]; difficulty: PracticeSession["difficulty"];
  raw: string; questions: Question[]; setId: string; count: number; random: boolean;
}
export interface PracticeData { version: 1; sets: QuestionSet[]; sessions: PracticeSession[]; draft?: PracticeSetupDraft; activeSessionId?: string }
const EMPTY: PracticeData = { version: 1, sets: [], sessions: [] };
let storePromise: Promise<Store> | undefined;
const store = () => storePromise ??= load("practice.json", { autoSave: 150 });
export const newId = () => crypto.randomUUID();
export function parseQuestions(raw: string): Question[] {
  return raw.split(/\r?\n/).map(line => line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim()).filter(Boolean).map(text => ({ id: newId(), text }));
}
export async function loadPractice(): Promise<PracticeData> {
  const saved = await (await store()).get<PracticeData>("data");
  if (!saved || saved.version !== 1 || !Array.isArray(saved.sets) || !Array.isArray(saved.sessions)) return structuredClone(EMPTY);
  return saved;
}
export async function savePractice(data: PracticeData): Promise<void> {
  const st = await store(); await st.set("data", data); await st.save();
}
export function shuffleQuestions(items: Question[]): Question[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

/** Portable, versioned set format. Session history and private context are excluded. */
export function exportQuestionSet(set: QuestionSet): string {
  return JSON.stringify({ format: "fuckmeetings-question-set", version: 1, title: set.title, questions: set.questions.map(q => q.text) }, null, 2);
}
export function importQuestionSet(raw: string): QuestionSet {
  if (raw.length > 2_000_000) throw new Error("Файл набора слишком большой (максимум 2 МБ).");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Неверный формат JSON набора вопросов."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Неверный формат набора вопросов.");
  const record = value as Record<string, unknown>;
  if (record.format !== "fuckmeetings-question-set" || record.version !== 1 || typeof record.title !== "string" || !Array.isArray(record.questions)) throw new Error("Неподдерживаемый формат набора вопросов.");
  if (!record.questions.length || record.questions.length > 500 || record.questions.some(q => typeof q !== "string" || !q.trim() || q.length > 10_000)) throw new Error("Набор должен содержать от 1 до 500 непустых вопросов (до 10 000 символов каждый).");
  return { id: newId(), title: record.title.trim().slice(0, 200) || "Импортированный набор", questions: (record.questions as string[]).map(text => ({ id: newId(), text: text.trim() })), updatedAt: new Date().toISOString() };
}
