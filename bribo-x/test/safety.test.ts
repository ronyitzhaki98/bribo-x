import { describe, expect, it } from "vitest";
import { deterministicReject, passedIds } from "../src/safety.js";

describe("deterministicReject", () => {
  it("passes a clean in-character post", () => {
    expect(deterministicReject("DECREE #12: Doomscrolling after midnight is now taxed. Per scroll.", [])).toBeNull();
  });
  it.each([
    ["", "empty"],
    ["x".repeat(281), "too long"],
    ["read this https://example.com", "url"],
    ["visit bribo.com today", "url"],
    ["hey @elonmusk", "mention"],
    ["#one #two", "hashtags"],
    ["the senator agrees", "blocklist"],
    ["donate to my paypal", "money"],
  ])("rejects %j (%s)", (text, reason) => {
    expect(deterministicReject(text, [])).toBe(reason);
  });
  it("allows one hashtag", () => {
    expect(deterministicReject("Long live the Palace #Tiktokistan", [])).toBeNull();
  });
  it("rejects near-duplicates of recent posts", () => {
    expect(deterministicReject("Doomscrollers will be deported today", ["Doomscrollers will be deported tomorrow"])).toBe("duplicate");
  });
});

describe("passedIds", () => {
  it("returns only explicit passes", () => {
    const v = { verdicts: [{ id: "a", verdict: "pass", reason: "" }, { id: "b", verdict: "fail", reason: "politics" }] };
    expect([...passedIds(v, ["a", "b", "c"])]).toEqual(["a"]);
  });
  it("fails closed on malformed input", () => {
    expect(passedIds("nonsense", ["a"]).size).toBe(0);
    expect(passedIds({ verdicts: [{ id: "a", verdict: "PASS" }] }, ["a"]).size).toBe(0);
  });
  it("ignores ids that were not asked about", () => {
    expect(passedIds({ verdicts: [{ id: "z", verdict: "pass", reason: "" }] }, ["a"]).size).toBe(0);
  });
});
