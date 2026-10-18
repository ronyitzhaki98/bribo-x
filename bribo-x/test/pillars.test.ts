import { describe, expect, it } from "vitest";
import { PILLARS, pickPillar } from "../src/pillars.js";

const now = new Date("2026-10-15T12:00:00Z");

describe("pickPillar", () => {
  it("weights sum to 100", () => {
    expect(Object.values(PILLARS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("starts with news when there is no history", () => {
    expect(pickPillar([], now)).toBe("news");
  });
  it("picks the most under-served pillar", () => {
    const recent = Array.from({ length: 10 }, () => ({ at: "2026-10-14T12:00:00Z", pillar: "news" as const }));
    expect(pickPillar(recent, now)).toBe("tiktokistan");
  });
  it("ignores posts older than 7 days", () => {
    const old = Array.from({ length: 10 }, () => ({ at: "2026-10-01T12:00:00Z", pillar: "tiktokistan" as const }));
    expect(pickPillar(old, now)).toBe("news");
  });
});
