import { describe, expect, it } from "vitest";
import { extractJson } from "../src/llm.js";

describe("extractJson", () => {
  it("joins text blocks and parses JSON, ignoring non-text blocks", () => {
    expect(extractJson({ stop_reason: "end_turn", content: [{ type: "fallback" }, { type: "text", text: '{"a":' }, { type: "text", text: "1}" }] })).toEqual({ a: 1 });
  });
  it("throws on refusal", () => {
    expect(() => extractJson({ stop_reason: "refusal", content: [] })).toThrow(/refus/);
  });
  it("throws on truncation", () => {
    expect(() => extractJson({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] })).toThrow(/truncat/);
  });
  it("throws on invalid JSON", () => {
    expect(() => extractJson({ stop_reason: "end_turn", content: [{ type: "text", text: "nope" }] })).toThrow();
  });
});

import { AnthropicLlm } from "../src/llm.js";

describe("AnthropicLlm.judge logging", () => {
  const fakeClient = (create: () => Promise<unknown>) => ({ messages: { create }, beta: { messages: { create } } }) as never;

  it("logs the reason for every failed item", async () => {
    const logs: string[] = [];
    const llm = new AnthropicLlm("v", fakeClient(async () => ({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify({ verdicts: [{ id: "a", verdict: "fail", reason: "names a politician" }, { id: "b", verdict: "pass", reason: "" }] }) }],
    })), (l) => logs.push(l));
    expect([...(await llm.judge([{ id: "a", text: "x" }, { id: "b", text: "y" }]))]).toEqual(["b"]);
    expect(logs.join("\n")).toContain("a: names a politician");
  });

  it("logs judge errors and fails closed", async () => {
    const logs: string[] = [];
    const llm = new AnthropicLlm("v", fakeClient(async () => { throw new Error("400 bad request"); }), (l) => logs.push(l));
    expect((await llm.judge([{ id: "a", text: "x" }])).size).toBe(0);
    expect(logs.join("\n")).toContain("400 bad request");
  });
});
