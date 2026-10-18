import { spawn } from "node:child_process";
import {
  BANK_SCHEMA, BankZ, POSTS_SCHEMA, PostsZ, REPLIES_SCHEMA, RepliesZ, VERDICTS_SCHEMA,
  judgeResult, type Candidate, type Llm, type ReplyDraft,
} from "./llm.js";
import type { Pillar } from "./pillars.js";
import {
  JUDGE_SYSTEM, buildBankPrompt, buildJudgePrompt, buildPostPrompt, buildReplyPrompt, type PostPromptInput,
} from "./prompts.js";

// Claude Code prefers ANTHROPIC_API_KEY over the subscription token, so strip it.
export function cliEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _drop, ...rest } = env;
  return rest;
}

export type RunClaude = (args: string[], stdin: string) => Promise<string>;

const defaultRun: RunClaude = (args, stdin) =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["-y", "@anthropic-ai/claude-code", ...args], { stdio: ["pipe", "pipe", "pipe"], timeout: 300_000, env: cliEnv(process.env) });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`))));
    child.stdin.end(stdin);
  });

export function parseCliResult(stdout: string): unknown {
  const env = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown };
  if (env.is_error) throw new Error(`Claude Code error: ${env.result ?? "unknown"}`);
  if (env.structured_output !== undefined) return env.structured_output;
  if (typeof env.result === "string") return JSON.parse(env.result);
  throw new Error("No structured output in Claude Code result");
}

export class ClaudeCodeLlm implements Llm {
  constructor(private voice: string, private run: RunClaude = defaultRun, private log: (l: string) => void = () => {}) {}

  private async call(model: "opus" | "haiku", system: string, schema: object, prompt: string): Promise<unknown> {
    const args = ["-p", "--model", model, "--system-prompt", system, "--json-schema", JSON.stringify(schema), "--output-format", "json", "--tools", ""];
    return parseCliResult(await this.run(args, prompt));
  }

  async writePosts(i: PostPromptInput): Promise<Candidate[]> {
    return PostsZ.parse(await this.call("opus", this.voice, POSTS_SCHEMA, buildPostPrompt(i))).posts;
  }

  async writeReplies(i: Parameters<typeof buildReplyPrompt>[0]): Promise<ReplyDraft[]> {
    return RepliesZ.parse(await this.call("opus", this.voice, REPLIES_SCHEMA, buildReplyPrompt(i))).replies;
  }

  async writeBank(i: { pillar: Pillar; count: number; avoid: string[] }): Promise<string[]> {
    return BankZ.parse(await this.call("opus", this.voice, BANK_SCHEMA, buildBankPrompt(i))).posts;
  }

  async judge(items: { id: string; text: string; context?: string; headline?: string }[]): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    try {
      return judgeResult(await this.call("haiku", JUDGE_SYSTEM, VERDICTS_SCHEMA, buildJudgePrompt(items)), items, this.log);
    } catch (e) {
      this.log(`Judge error: ${(e as Error).message}`);
      return new Set();
    }
  }
}
