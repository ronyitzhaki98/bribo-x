import { describe, expect, it } from "vitest";
import { ClaudeCodeLlm, parseCliResult } from "../src/cli-llm.js";

const envelope = (structured: unknown) => JSON.stringify({ type: "result", is_error: false, structured_output: structured });

describe("parseCliResult", () => {
  it("returns the structured output", () => {
    expect(parseCliResult(envelope({ posts: [] }))).toEqual({ posts: [] });
  });
  it("falls back to JSON in the result text", () => {
    expect(parseCliResult(JSON.stringify({ is_error: false, result: '{"posts":[]}' }))).toEqual({ posts: [] });
  });
  it("throws on errors (e.g. usage limit reached)", () => {
    expect(() => parseCliResult(JSON.stringify({ is_error: true, result: "limit reached" }))).toThrow(/limit/);
  });
});

describe("ClaudeCodeLlm", () => {
  it("writes posts via the CLI with the opus model and the voice as system prompt", async () => {
    const calls: string[][] = [];
    const llm = new ClaudeCodeLlm("VOICE", async (args) => {
      calls.push(args);
      return envelope({ posts: [{ parts: ["Hello citizens"], pillar: "news", headline_ref: "" }] });
    });
    const out = await llm.writePosts({ today: "d", pillar: "news", headlines: [], recent: [], decreeNumber: 1, allowThread: false });
    expect(out[0].parts).toEqual(["Hello citizens"]);
    expect(calls[0]).toContain("opus");
    expect(calls[0]).toContain("VOICE");
  });
  it("judge fails closed when the CLI errors", async () => {
    const llm = new ClaudeCodeLlm("V", async () => { throw new Error("exit 1"); });
    expect((await llm.judge([{ id: "a", text: "x" }])).size).toBe(0);
  });
});

describe("cliEnv", () => {
  it("removes ANTHROPIC_API_KEY so Claude Code uses the subscription token", async () => {
    const { cliEnv } = await import("../src/cli-llm.js");
    const env = cliEnv({ ANTHROPIC_API_KEY: "sk", CLAUDE_CODE_OAUTH_TOKEN: "tok", PATH: "/bin" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("tok");
    expect(env.PATH).toBe("/bin");
  });
});
