import { streamChat, type StreamHandle } from "./llm";
import type { Settings } from "./types";
import { extractJson } from "./utils";

export type PracticeInterviewType = "technical" | "recruiter" | "mixed";
export type PracticeDifficulty = "easy" | "medium" | "hard";

export interface PracticeContext {
  role: string;
  vacancy?: string;
  resume?: string;
  interviewType: PracticeInterviewType;
  difficulty: PracticeDifficulty;
}

export interface PracticeAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface PracticeAnswerFeedback {
  questionId: string;
  verdict?: "strong" | "partial" | "incorrect" | "uncertain";
  corrections?: string[];
  uncertainty?: string;
  strengths: string[];
  improvements: string[];
  missingTopics: string[];
  exampleImprovement: string;
  suggestedForReview: boolean;
}

export interface PracticeAnalysis {
  summary: string;
  strengths: string[];
  recommendations: string[];
  feedback: PracticeAnswerFeedback[];
}

const MAX_CONTEXT = 12_000;
const MAX_ANSWER = 6_000;
const MAX_QUESTIONS = 30;

function limited(value: string | undefined, max = MAX_CONTEXT): string {
  const text = (value ?? "").trim();
  return text.length <= max ? text : `${text.slice(0, max)}\n[Текст сокращён]`;
}

function contextText(context: PracticeContext): string {
  return JSON.stringify({
    role: limited(context.role, 300),
    vacancy: limited(context.vacancy),
    resume: limited(context.resume),
    interviewType: context.interviewType,
    difficulty: context.difficulty,
  });
}

function request(settings: Settings, system: string, user: string): StreamHandle {
  const provider = settings.activeProvider;
  const config = settings.providers[provider];
  if (!config) throw new Error("Настройте ИИ-провайдера для тренировки.");
  return streamChat({
    provider,
    config,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    onDelta: () => {},
  });
}

function parseQuestions(raw: string, count: number): string[] {
  const parsed = extractJson<unknown>(raw);
  const values = Array.isArray(parsed) ? parsed :
    parsed && typeof parsed === "object" ? (parsed as { questions?: unknown }).questions : null;
  if (!Array.isArray(values)) throw new Error("ИИ вернул неверный формат вопросов. Повторите запрос.");
  const questions = values
    .map((value) => typeof value === "string" ? value.trim() : null)
    .filter((value): value is string => !!value);
  if (!questions.length) throw new Error("ИИ не вернул вопросов. Повторите запрос.");
  return [...new Set(questions)].slice(0, count);
}

/** Generates editable question text using the currently selected provider. */
export function generatePracticeQuestions(
  settings: Settings,
  context: PracticeContext,
  count: number,
): { promise: Promise<string[]>; cancel: () => void } {
  if (!context.role.trim()) throw new Error("Укажите должность.");
  if (!Number.isInteger(count) || count < 1 || count > MAX_QUESTIONS) {
    throw new Error(`Количество вопросов должно быть от 1 до ${MAX_QUESTIONS}.`);
  }
  const handle = request(settings,
    "Ты проводишь тренировочное собеседование. Верни только JSON: {\"questions\":[\"вопрос\"]}. Вопросы должны быть конкретными, разнообразными, соответствовать должности, типу и сложности. Для технического интервью включай при необходимости практические задачи по коду, SQL, алгоритмам и объяснению решений. Формулируй условия задачи полностью, включая входные данные и ожидаемый результат, когда это уместно. Не выдумывай факты о кандидате. Язык вопросов — язык должности и вакансии, по умолчанию русский.",
    JSON.stringify({ context: contextText(context), count }),
  );
  return { promise: handle.promise.then((raw) => parseQuestions(raw, count)), cancel: handle.cancel };
}

/** Gives a scaffold without revealing the solution. */
export function generatePracticeHint(settings: Settings, context: PracticeContext, question: string): { promise: Promise<string>; cancel: () => void } {
  if (!question.trim()) throw new Error("Нет вопроса для подсказки.");
  const handle = request(settings,
    "Ты наставник на тренировке собеседования. Дай одну короткую подсказку о подходе к решению. Не раскрывай ответ, готовый код, SQL-запрос, алгоритм целиком, ключевой вывод или пример полного решения. Если это задача по программированию, предложи подумать о граничных случаях или структуре данных. Верни только текст подсказки.",
    JSON.stringify({ context: contextText(context), question: limited(question, 4_000) }),
  );
  return { promise: handle.promise.then(raw => { const hint = raw.trim(); if (!hint) throw new Error("ИИ не вернул подсказку."); return hint; }), cancel: handle.cancel };
}

/** Adds one optional follow-up; the caller keeps the original question intact. */
export function generatePracticeFollowUp(
  settings: Settings,
  context: PracticeContext,
  question: string,
  answer: string,
): { promise: Promise<string>; cancel: () => void } {
  if (!question.trim()) throw new Error("Нет исходного вопроса.");
  const handle = request(settings,
    "Ты интервьюер. Задай ровно один короткий уточняющий вопрос к ответу кандидата. Не подменяй исходный вопрос. Верни только текст вопроса, без комментариев и оценки. Если ответ пуст, уточни исходный вопрос.",
    JSON.stringify({ context: contextText(context), question: limited(question, 2_000), answer: limited(answer, MAX_ANSWER) }),
  );
  return { promise: handle.promise.then((raw) => {
    const followUp = raw.trim().replace(/^```(?:text)?\s*|\s*```$/g, "").trim();
    if (!followUp) throw new Error("ИИ не вернул уточнение. Повторите запрос.");
    return followUp;
  }), cancel: handle.cancel };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim()) : [];
}

function parseAnalysis(raw: string, answered: PracticeAnswer[]): PracticeAnalysis {
  const value = extractJson<unknown>(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ИИ вернул неверный формат разбора.");
  const data = value as Record<string, unknown>;
  const input = Array.isArray(data.feedback) ? data.feedback : [];
  const feedback = input.flatMap((item): PracticeAnswerFeedback[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.questionId !== "string" || !answered.some((answer) => answer.questionId === row.questionId)) return [];
    return [{
      questionId: row.questionId,
      verdict: ["strong", "partial", "incorrect", "uncertain"].includes(String(row.verdict)) ? row.verdict as PracticeAnswerFeedback["verdict"] : "uncertain",
      corrections: stringList(row.corrections),
      uncertainty: typeof row.uncertainty === "string" ? row.uncertainty.trim() : "",
      strengths: stringList(row.strengths),
      improvements: stringList(row.improvements),
      missingTopics: stringList(row.missingTopics),
      exampleImprovement: typeof row.exampleImprovement === "string" ? row.exampleImprovement.trim() : "",
      suggestedForReview: row.suggestedForReview === true,
    }];
  });
  if (typeof data.summary !== "string" || !feedback.length) throw new Error("ИИ вернул неполный разбор. Повторите запрос.");
  return { summary: data.summary.trim(), strengths: stringList(data.strengths), recommendations: stringList(data.recommendations), feedback };
}

/** Analyzes answered questions only, so skips and early completion stay out of feedback. */
export function analyzePracticeSession(
  settings: Settings,
  context: PracticeContext,
  answers: PracticeAnswer[],
): { promise: Promise<PracticeAnalysis>; cancel: () => void } {
  const answered = answers.filter((item) => item.answer.trim());
  if (!answered.length) throw new Error("Для разбора нужен хотя бы один ответ.");
  const handle = request(settings,
    `Ты помогаешь готовиться к собеседованию. Анализируй только переданные ответы. Не выдумывай опыт, навыки, достижения или содержание ответа. Оценка — субъективное мнение модели, не объективный результат интервью. Если ответ содержит код или SQL, не заявляй, что код исполнен или проверен тестами; анализируй только текст, указывай неопределённость, не гарантируй корректность. Для каждого ответа дай verdict: strong, partial, incorrect или uncertain. strong только при достаточных основаниях; partial при частичной верности; incorrect при конкретной проверяемой ошибке; uncertain при недостатке сведений или невозможности подтвердить код без выполнения. В corrections укажи конкретные исправления ошибочных утверждений с объяснением. В uncertainty поясни границы оценки. Не объявляй ответ неверным лишь за отсутствие деталей. Рекомендации и примеры привязывай к конкретным вопросам и фактическим ответам. Верни только JSON: {"summary":"...","strengths":["..."],"recommendations":["..."],"feedback":[{"questionId":"...","verdict":"strong|partial|incorrect|uncertain","corrections":["..."],"uncertainty":"...","strengths":["..."],"improvements":["..."],"missingTopics":["..."],"exampleImprovement":"...","suggestedForReview":true}]}. В feedback включи каждый переданный вопрос ровно один раз.`,
    JSON.stringify({ context: contextText(context), answers: answered.map((item) => ({ questionId: item.questionId, question: limited(item.question, 2_000), answer: limited(item.answer, MAX_ANSWER) })) }),
  );
  return { promise: handle.promise.then((raw) => parseAnalysis(raw, answered)), cancel: handle.cancel };
}
