import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PILLAR_LIST, type Pillar } from "./pillars.js";
import {
  JUDGE_SYSTEM, buildBankPrompt, buildJudgePrompt, buildPostPrompt, buildReplyPrompt, type PostPromptInput,
} from "./prompts.js";
import { passedIds } from "./safety.js";

export type Candidate = { parts: string[]; pillar: Pillar; headline_ref: string };
export type ReplyDraft = { mention_id: string; text: string };

export interface Llm {
  writePosts(i: PostPromptInput): Promise<Candidate[]>;
  writeReplies(i: Parameters<typeof buildReplyPrompt>[0]): Promise<ReplyDraft[]>;
  judge(items: { id: string; text: string; context?: string; headline?: string }[]): Promise<Set<string>>;
  writeBank(i: { pillar: Pillar; count: number; avoid: string[] }): Promise<string[]>;
}

const WRITER_MODEL = "claude-opus-5-5";
const JUDGE_MODEL = "claude-haiku-5-5";

export function extractJson(res: { stop_reason: string | null; content: { type: string; text?: string }[] }): unknown {
  if (res.stop_reason === "refusal") throw new Error("Claude refused the request");
  if (res.stop_reason === "max_tokens") throw new Error("Claude response truncated");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  return JSON.parse(text);
}

const obj = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

export const POSTS_SCHEMA = obj({
  posts: { type: "array", items: obj({
    parts: { type: "array", items: { type: "string" } },
    pillar: { type: "string", enum: PILLAR_LIST },
    headline_ref: { type: "string" },
  }) },
});
export const REPLIES_SCHEMA = obj({ replies: { type: "array", items: obj({ mention_id: { type: "string" }, text: { type: "string" } }) } });
export const VERDICTS_SCHEMA = obj({ verdicts: { type: "array", items: obj({
  id: { type: "string" }, verdict: { type: "string", enum: ["pass", "fail"] }, reason: { type: "string" },
}) } });
export const BANK_SCHEMA = obj({ posts: { type: "array", items: { type: "string" } } });

export const PostsZ = z.object({ posts: z.array(z.object({
  parts: z.array(z.string()).min(1).max(4), pillar: z.enum(PILLAR_LIST as [Pillar, ...Pillar[]]), headline_ref: z.string(),
})) });
export const RepliesZ = z.object({ replies: z.array(z.object({ mention_id: z.string(), text: z.string() })) });
export const BankZ = z.object({ posts: z.array(z.string()) });

/** Passed ids, logging the reason for every item that did not pass. */
export function judgeResult(raw: unknown, items: { id: string }[], log: (l: string) => void): Set<string> {
  const passed = passedIds(raw, items.map((i) => i.id));
  const reasons = new Map<string, string>();
  for (const v of (raw as { verdicts?: { id?: string; reason?: string }[] } | null)?.verdicts ?? []) {
    if (v?.id) reasons.set(v.id, v.reason ?? "");
  }
  for (const i of items) if (!passed.has(i.id)) log(`Judge: ${i.id}: ${reasons.get(i.id) || "no valid verdict"}`);
  return passed;
}

export class AnthropicLlm implements Llm {
  constructor(private voice: string, private client: Anthropic = new Anthropic(), private log: (l: string) => void = () => {}) {}

  private async write(user: string, schema: object, maxTokens: number): Promise<unknown> {
    const params = {
      model: WRITER_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      cache_control: { type: "ephemeral" },
      system: this.voice,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
    } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
    const res = await this.client.beta.messages.create(params);
    return extractJson(res as unknown as Parameters<typeof extractJson>[0]);
  }

  async writePosts(i: PostPromptInput): Promise<Candidate[]> {
    return PostsZ.parse(await this.write(buildPostPrompt(i), POSTS_SCHEMA, 4000)).posts;
  }

  async writeReplies(i: Parameters<typeof buildReplyPrompt>[0]): Promise<ReplyDraft[]> {
    return RepliesZ.parse(await this.write(buildReplyPrompt(i), REPLIES_SCHEMA, 4000)).replies;
  }

  async writeBank(i: { pillar: Pillar; count: number; avoid: string[] }): Promise<string[]> {
    return BankZ.parse(await this.write(buildBankPrompt(i), BANK_SCHEMA, 16000)).posts;
  }

  async judge(items: { id: string; text: string; context?: string; headline?: string }[]): Promise<Set<string>> {
    if (items.length === 0) return new Set();
    const params = {
      model: JUDGE_MODEL,
      max_tokens: 2000,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: buildJudgePrompt(items) }],
      output_config: { effort: "low", format: { type: "json_schema", schema: VERDICTS_SCHEMA } },
    } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;
    try {
      const res = await this.client.messages.create(params);
      return judgeResult(extractJson(res as unknown as Parameters<typeof extractJson>[0]), items, this.log);
    } catch (e) {
      this.log(`Judge error: ${(e as Error).message}`);
      return new Set();
    }
  }
}
