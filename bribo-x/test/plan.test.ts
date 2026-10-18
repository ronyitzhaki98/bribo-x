import { describe, expect, it } from "vitest";
import { SLOT_HOURS, dayKeyFor, planDay, slotFor, slotKey } from "../src/plan.js";

describe("planDay", () => {
  it("is deterministic per day", () => {
    expect(planDay("2026-10-15")).toEqual(planDay("2026-10-15"));
  });
  it("always picks 2–10 distinct sorted slots matching the target", () => {
    for (let d = 1; d <= 365; d++) {
      const key = new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10);
      const p = planDay(key);
      expect(p.target).toBeGreaterThanOrEqual(2);
      expect(p.target).toBeLessThanOrEqual(10);
      expect(p.slots).toHaveLength(p.target);
      expect(new Set(p.slots).size).toBe(p.target);
      expect([...p.slots].sort((a, b) => a - b)).toEqual(p.slots);
      p.slots.forEach((s) => expect(s).toBeLessThan(SLOT_HOURS.length));
    }
  });
  it("averages roughly 5–6 posts a day", () => {
    let sum = 0;
    for (let d = 1; d <= 365; d++) sum += planDay(new Date(Date.UTC(2026, 0, d)).toISOString().slice(0, 10)).target;
    expect(sum / 365).toBeGreaterThan(4.5);
    expect(sum / 365).toBeLessThan(6.5);
  });
});

describe("slotFor", () => {
  it("maps an on-time run to its slot", () => {
    expect(slotFor(new Date("2026-10-15T14:17:00Z"))).toEqual({ dayKey: "2026-10-15", index: 2 });
  });
  it("maps a late run (+40 min) to the same slot", () => {
    expect(slotFor(new Date("2026-10-15T14:57:00Z"))).toEqual({ dayKey: "2026-10-15", index: 2 });
  });
  it("maps after-midnight slots to the previous day", () => {
    expect(slotFor(new Date("2026-10-16T02:17:00Z"))).toEqual({ dayKey: "2026-10-15", index: 8 });
    expect(dayKeyFor(new Date("2026-10-16T04:17:00Z"))).toBe("2026-10-15");
  });
  it("returns null outside the posting window", () => {
    expect(slotFor(new Date("2026-10-15T07:00:00Z"))).toBeNull();
  });
  it("formats slot keys", () => {
    expect(slotKey({ dayKey: "2026-10-15", index: 3 })).toBe("2026-10-15#3");
  });
});
