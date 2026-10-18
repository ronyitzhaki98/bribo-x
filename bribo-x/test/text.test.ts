import { describe, expect, it } from "vitest";
import { maxSimilarity, normalize, similarity, weightedLength } from "../src/text.js";

describe("weightedLength", () => {
  it("counts latin characters as 1", () => {
    expect(weightedLength("DECREE #1: no.")).toBe(14);
  });
  it("counts emoji and CJK code points as 2", () => {
    expect(weightedLength("🪙")).toBe(2);
    expect(weightedLength("中")).toBe(2);
  });
  it("counts curly quotes and dashes as 1", () => {
    expect(weightedLength("“—”")).toBe(3);
  });
});

describe("similarity", () => {
  it("normalizes case and punctuation", () => {
    expect(normalize("  Hello,  WORLD!! ")).toBe("hello world");
  });
  it("is 1 for identical text and 0 for disjoint text", () => {
    expect(similarity("the palace is closed", "The palace is CLOSED.")).toBe(1);
    expect(similarity("abc", "xyz")).toBe(0);
  });
  it("is high for near-duplicates", () => {
    expect(similarity("Doomscrollers will be deported today", "Doomscrollers will be deported tomorrow")).toBeGreaterThan(0.5);
  });
  it("maxSimilarity returns 0 for an empty list", () => {
    expect(maxSimilarity("anything", [])).toBe(0);
  });
});
