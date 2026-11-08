import { Channel, invoke } from "@tauri-apps/api/core";
import type { AgentEvent } from "./types";

export function runAgent(opts: {
  kind: "claude" | "codex";
  prompt: string;
  command?: string;
  workdir?: string;
  onEvent: (e: AgentEvent) => void;
}): Promise<void> {
  const channel = new Channel<AgentEvent>();
  channel.onmessage = (e) => opts.onEvent(e);
  return invoke("run_agent", {
    kind: opts.kind,
    prompt: opts.prompt,
    command: opts.command ?? null,
    workdir: opts.workdir ?? null,
    onEvent: channel,
  });
}
