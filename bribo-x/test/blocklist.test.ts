import { describe, expect, it } from "vitest";
import { isBlockedHeadline, isBlockedOutput } from "../src/blocklist.js";

describe("blocklists", () => {
  it.each([
    "Senate passes new budget bill",
    "Three killed in highway crash",
    "Earthquake hits coastal city",
    "Election polls tighten in final week",
    "Government announces new tax plan",
  ])("blocks headline: %s", (h) => expect(isBlockedHeadline(h)).toBe(true));

  it.each([
    "Apple unveils thinner phone nobody asked for",
    "New dance trend takes over TikTok",
    "Billionaire buys fourth yacht",
  ])("allows headline: %s", (h) => expect(isBlockedHeadline(h)).toBe(false));

  it("allows Bribo's own vocabulary in output", () => {
    expect(isBlockedOutput("DECREE #4: the Prime Minister's government has deported your attention span. Coup attempts will be taxed.")).toBe(false);
  });

  it("blocks politics and tragedy in output", () => {
    expect(isBlockedOutput("Even the senator agrees with me")).toBe(true);
    expect(isBlockedOutput("This post killed me")).toBe(true);
  });

  it("matches whole words only", () => {
    expect(isBlockedOutput("Skill issue")).toBe(false);
  });
});
