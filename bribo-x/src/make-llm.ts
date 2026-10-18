import { ClaudeCodeLlm } from "./cli-llm.js";
import { AnthropicLlm, type Llm } from "./llm.js";

const SWITCH_AT = Date.parse("2026-11-01T00:00:00Z");

export function llmMode(env: Record<string, string | undefined>, now: Date): "api" | "subscription" {
  if (env.BRIBO_X_LLM === "api" || env.BRIBO_X_LLM === "subscription") return env.BRIBO_X_LLM;
  return now.getTime() < SWITCH_AT ? "api" : "subscription";
}

export function makeLlm(env: Record<string, string | undefined>, now: Date, voice: string, log: (l: string) => void = () => {}): Llm {
  return llmMode(env, now) === "api" ? new AnthropicLlm(voice, undefined, log) : new ClaudeCodeLlm(voice, undefined, log);
}
