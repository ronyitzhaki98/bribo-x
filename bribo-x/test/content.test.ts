import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PILLARS, PILLAR_LIST } from "../src/pillars.js";
import { deterministicReject } from "../src/safety.js";
import type { BankItem } from "../src/state.js";

const dir = path.resolve(import.meta.dirname, "../content");
const bank = JSON.parse(readFileSync(path.join(dir, "bank.json"), "utf8")) as BankItem[];
const replies = JSON.parse(readFileSync(path.join(dir, "replies.json"), "utf8")) as { situation: string; mention: string; reply: string }[];
const voice = readFileSync(path.join(dir, "voice.md"), "utf8");

describe("content", () => {
  it("bank has ≥120 unique, valid items that each pass the deterministic checks", () => {
    expect(bank.length).toBeGreaterThanOrEqual(120);
    expect(new Set(bank.map((b) => b.id)).size).toBe(bank.length);
    const seen: string[] = [];
    for (const b of bank) {
      expect(PILLAR_LIST).toContain(b.pillar);
      expect(deterministicReject(b.text, seen), b.text).toBeNull();
      seen.push(b.text);
    }
  });
  it("bank roughly follows the pillar weights", () => {
    for (const p of PILLAR_LIST) {
      const n = bank.filter((b) => b.pillar === p).length;
      expect(Math.abs(n - (PILLARS[p] * 120) / 100), p).toBeLessThanOrEqual(3 + (bank.length - 120) * PILLARS[p] / 100);
    }
  });
  it("reply examples cover every situation and pass the checks", () => {
    const situations = ["praise", "insult", "is this AI", "W or L", "ratio attempt", "money or gifts", "when LIVE", "other bots", "say something", "random question", "defecting", "complaint"];
    expect(replies.length).toBeGreaterThanOrEqual(60);
    for (const s of situations) expect(replies.filter((r) => r.situation === s).length, s).toBeGreaterThanOrEqual(5);
    for (const r of replies) expect(deterministicReject(r.reply, []), r.reply).toBeNull();
  });
  it("voice states the red lines", () => {
    expect(voice).toMatch(/politic/i);
    expect(voice).toMatch(/never break character/i);
    expect(voice.split(/\s+/).length).toBeGreaterThan(1500);
  });
});
