export type ProviderId =
  | "codex"
  | "claude-code"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "deepseek"
  | "groq"
  | "ollama"
  | "custom";

export type WireKind = "openai" | "anthropic" | "gemini";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  short: string;
  wire: WireKind;
  defaultBaseUrl: string;
  defaultModel: string;
  models: string[];
  vision: boolean;
  requiresKey: boolean;
  keyHint: string;
  color: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type ShortcutAction = "show" | "clickThrough" | "send" | "up" | "down" | "left" | "right" | "screen" | "region";
export type Shortcuts = Record<ShortcutAction, string>;

export interface Settings {
  theme: "light" | "dark";
  uiLanguage: "ru" | "en" | "es";
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  claudeCommand: string;
  codexCommand: string;
  overlayHotkey: string;
  shortcuts: Shortcuts;
  transcriptionMode: "api" | "local" | "deepgram";
  deepgramKey: string;
  deepgramModel: string;
  whisperExecutable: string;
  whisperModelPath: string;
  transcriptionUrl: string;
  transcriptionKey: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  temperature: number;
  systemPrompt: string;
  interviewResume: string;
  interviewResumeName: string;
  interviewInstructions: string;
  interviewContextEnabled: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export type LlmEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

export type AgentEvent =
  | { type: "stdout"; line: string }
  | { type: "stderr"; line: string }
  | { type: "exit"; code: number | null }
  | { type: "error"; message: string };

export interface AtsFilter {
  name: string;
  present: boolean;
  note: string;
}

export interface AtsAnalysis {
  matchScore: number;
  verdict: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  filters: AtsFilter[];
  recommendations: string[];
}

export interface ExperienceItem {
  title: string;
  company?: string;
  period?: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution?: string;
  year?: string;
}

export interface TailoredResume {
  title: string;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  markdown: string;
}
