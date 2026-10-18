import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import type { Candidate, Llm } from "../src/llm.js";
import { planDay, slotKey } from "../src/plan.js";
import { runPostJob } from "../src/post-job.js";
import { appendPost, readBankUsed, readCursor, readPosts } from "../src/state.js";
import { XError, type XClient } from "../src/x.js";

// Find a time whose slot is in that day's plan.
function postingTime(): Date {
  for (let d = 1; d < 60; d++) {
    const dayKey = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
    const index = planDay(dayKey).slots[0];
    const hour = [10, 12, 14, 16, 18, 20, 22, 0, 2, 4][index];
    if (hour >= 10) return new Date(`${dayKey}T${String(hour).padStart(2, "0")}:17:00Z`);
  }
  throw new Error("no slot");
}
function offTime(): Date {
  for (let d = 1; d < 60; d++) {
    const dayKey = new Date(Date.UTC(2026, 9, d)).toISOString().slice(0, 10);
    const free = [0, 1, 2, 3, 4, 5, 6].find((i) => !planDay(dayKey).slots.includes(i));
    if (free !== undefined) return new Date(`${dayKey}T${String([10, 12, 14, 16, 18, 20, 22][free]).padStart(2, "0")}:17:00Z`);
  }
  throw new Error("no free slot");
}

function setup(over: Partial<Config> = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "bribo-post-"));
  const config: Config = {
    dryRun: false, forceSlot: false, stateDir: path.join(root, "state"), contentDir: root, outDir: path.join(root, "out"),
    now: postingTime(), ...over,
  };
  writeFileSync(path.join(root, "bank.json"), JSON.stringify([
    { id: "b1", pillar: "doomscrollers", text: "Bank post one about doomscrollers and their thumbs" },
    { id: "b2", pillar: "tiktokistan", text: "Bank post two: the Palace is open, attendance mandatory" },
  ]));
  return config;
}

const cand = (text: string, pillar: Candidate["pillar"] = "news"): Candidate => ({ parts: [text], pillar, headline_ref: "" });

function fakes(opts: { candidates?: Candidate[]; pass?: (id: string) => boolean; postError?: (n: number) => Error | null; writeFails?: boolean } = {}) {
  const posted: { text: string; replyTo?: string }[] = [];
  const logs: string[] = [];
  const judged: string[][] = [];
  const judgedItems: { id: string; text: string; headline?: string }[] = [];
  const llm: Llm = {
    writePosts: async () => { if (opts.writeFails) throw new Error("boom"); return opts.candidates ?? []; },
    writeReplies: async () => [],
    writeBank: async () => [],
    judge: async (items) => { judged.push(items.map((i) => i.id)); judgedItems.push(...items); return new Set(items.map((i) => i.id).filter(opts.pass ?? (() => true))); },
  };
  let n = 0;
  const x: XClient = {
    me: async () => ({ id: "me", username: "PMBribo" }),
    mentions: async () => [],
    post: async (text, replyTo) => {
      const err = opts.postError?.(n++);
      if (err) throw err;
      posted.push({ text, replyTo });
      return `t${posted.length}`;
    },
  };
  return { llm, x, posted, logs, judged, judgedItems, log: (l: string) => logs.push(l), headlines: async () => [] };
}

describe("runPostJob", () => {
  it("skips when the slot is not in today's plan", async () => {
    const config = setup({ now: offTime() });
    const f = fakes({ candidates: [cand("A fine decree for a fine day")] });
    expect(await runPostJob({ config, ...f })).toBe("skipped");
    expect(f.posted).toEqual([]);
  });

  it("posts the first passing candidate and records it", async () => {
    const config = setup();
    const f = fakes({ candidates: [cand("DECREE #1: the senator is wrong"), cand("DECREE #1: Doomscrolling is now taxed per thumb movement")], });
    expect(await runPostJob({ config, ...f })).toBe("posted");
    expect(f.posted.map((p) => p.text)).toEqual(["DECREE #1: Doomscrolling is now taxed per thumb movement"]);
    const recs = readPosts(config.stateDir);
    expect(recs).toHaveLength(1);
    expect(recs[0].source).toBe("writer");
    expect(readCursor(config.stateDir).decree).toBe(1);
  });

  it("does not post twice for the same slot", async () => {
    const config = setup();
    const f = fakes({ candidates: [cand("A completely fresh decree about thumbs")] });
    await runPostJob({ config, ...f });
    const f2 = fakes({ candidates: [cand("Another totally different decree on scrolling")] });
    expect(await runPostJob({ config, ...f2 })).toBe("skipped");
    expect(f2.posted).toEqual([]);
  });

  it("falls back to the bank when the judge fails everything", async () => {
    const config = setup();
    const f = fakes({ candidates: [cand("Something the judge hates")], pass: () => false });
    expect(await runPostJob({ config, ...f })).toBe("posted");
    expect(f.posted[0].text).toMatch(/^Bank post one/);
    expect(readBankUsed(config.stateDir)).toEqual(["b1"]);
    expect(readPosts(config.stateDir)[0].source).toBe("bank");
  });

  it("falls back to the bank when the writer throws", async () => {
    const config = setup();
    const f = fakes({ writeFails: true });
    expect(await runPostJob({ config, ...f })).toBe("posted");
    expect(f.posted[0].text).toMatch(/^Bank post one/);
  });

  it("skips a used bank item", async () => {
    const config = setup();
    const f = fakes({ writeFails: true });
    await runPostJob({ config, ...f });
    const config2 = { ...config, forceSlot: true };
    const f2 = fakes({ writeFails: true });
    await runPostJob({ config: config2, ...f2 });
    expect(f2.posted[0].text).toMatch(/^Bank post two/);
  });

  it("tries the next candidate on duplicate content", async () => {
    const config = setup();
    const f = fakes({
      candidates: [cand("First decree about the attention economy"), cand("Second decree about the For You tab")],
      postError: (n) => (n === 0 ? new XError("duplicate", "dup") : null),
    });
    expect(await runPostJob({ config, ...f })).toBe("posted");
    expect(f.posted.map((p) => p.text)).toEqual(["Second decree about the For You tab"]);
    expect(readPosts(config.stateDir)).toHaveLength(1);
  });

  it("rethrows credit errors", async () => {
    const config = setup();
    const f = fakes({ candidates: [cand("A decree that will never land")], postError: () => new XError("credits", "402") });
    await expect(runPostJob({ config, ...f })).rejects.toThrow("402");
  });

  it("posts a thread as replies to itself", async () => {
    const config = setup();
    const f = fakes({ candidates: [{ parts: ["Founding decree, part one of the saga", "Part two: the saga continues, sadly"], pillar: "tiktokistan", headline_ref: "" }] });
    await runPostJob({ config, ...f });
    expect(f.posted).toEqual([
      { text: "Founding decree, part one of the saga", replyTo: undefined },
      { text: "Part two: the saga continues, sadly", replyTo: "t1" },
    ]);
  });

  it("drops threads when one already ran today", async () => {
    const config = setup();
    const today = slotKey({ dayKey: new Date(config.now.getTime() - 6 * 3600_000).toISOString().slice(0, 10), index: 99 });
    appendPost(config.stateDir, { at: config.now.toISOString(), slot: today, ids: ["a", "b"], parts: ["p1 old thread", "p2 old thread"], pillar: "news", source: "writer", headline_ref: "" });
    const f = fakes({ candidates: [{ parts: ["Thread part one again", "Thread part two again"], pillar: "news", headline_ref: "" }, cand("A single fresh post about scrolling")] });
    await runPostJob({ config, ...f });
    expect(f.posted.map((p) => p.text)).toEqual(["A single fresh post about scrolling"]);
  });

  it("dry run posts and records nothing", async () => {
    const config = setup({ dryRun: true });
    const f = fakes({ candidates: [cand("A dry decree about dryness")] });
    expect(await runPostJob({ config, ...f })).toBe("dry-run");
    expect(f.posted).toEqual([]);
    expect(readPosts(config.stateDir)).toEqual([]);
    expect(f.logs.join("\n")).toContain("A dry decree about dryness");
  });

  it("forceSlot runs outside the plan", async () => {
    const config = setup({ now: offTime(), forceSlot: true, dryRun: true });
    const f = fakes({ candidates: [cand("Forced decree for testing purposes")] });
    expect(await runPostJob({ config, ...f })).toBe("dry-run");
  });
});

describe("runPostJob partial thread", () => {
  it("records the parts that went out when a later thread part fails", async () => {
    const config = setup();
    const f = fakes({
      candidates: [{ parts: ["Thread opener about the Palace rules", "Second part that will fail to post"], pillar: "tiktokistan", headline_ref: "" }],
      postError: (n) => (n === 1 ? new XError("other", "500") : null),
    });
    await expect(runPostJob({ config, ...f })).rejects.toThrow("500");
    const recs = readPosts(config.stateDir);
    expect(recs).toHaveLength(1);
    expect(recs[0].parts).toEqual(["Thread opener about the Palace rules"]);
    expect(recs[0].ids).toEqual(["t1"]);
  });
});

describe("runPostJob judge context", () => {
  it("passes the headline each candidate reacts to", async () => {
    const config = setup({ dryRun: true });
    const f = fakes({ candidates: [{ parts: ["A take on the ninth camera"], pillar: "tech", headline_ref: "Phone maker adds ninth camera" }] });
    await runPostJob({ config, ...f });
    expect(f.judgedItems[0].headline).toBe("Phone maker adds ninth camera");
  });
});
