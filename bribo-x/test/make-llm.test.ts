import { describe, expect, it } from "vitest";
import { llmMode } from "../src/make-llm.js";

describe("llmMode", () => {
  it("uses the API before November 1 2026", () => {
    expect(llmMode({}, new Date("2026-10-31T23:59:00Z"))).toBe("api");
  });
  it("uses the subscription from November 1 2026", () => {
    expect(llmMode({}, new Date("2026-11-01T00:00:00Z"))).toBe("subscription");
  });
  it("honours an explicit override either way", () => {
    expect(llmMode({ BRIBO_X_LLM: "subscription" }, new Date("2026-10-15T00:00:00Z"))).toBe("subscription");
    expect(llmMode({ BRIBO_X_LLM: "api" }, new Date("2026-12-01T00:00:00Z"))).toBe("api");
  });
  it("ignores junk overrides", () => {
    expect(llmMode({ BRIBO_X_LLM: "grok" }, new Date("2026-12-01T00:00:00Z"))).toBe("subscription");
  });
});
