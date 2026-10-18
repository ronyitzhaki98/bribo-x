import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import type { Llm } from "../src/llm.js";
import { looksUnder18, runReplyJob } from "../src/reply-job.js";
import { appendReply, readCursor, readReplies, writeCursor } from "../src/state.js";
import { XError, type Mention, type XClient } from "../src/x.js";

const NOW = new Date("2026-10-15T12:47:00Z");

function setup(over: Partial<Config> = {}): Config {
  const root = mkdtempSync(path.join(tmpdir(), "bribo-reply-"));
  return { dryRun: false, forceSlot: false, stateDir: path.join(root, "state"), contentDir: root, outDir: root, now: NOW, ...over };
}

let seq = 100;
const m = (over: Partial<Mention> = {}): Mention => {
  const id = String(seq++);
  return { id, text: "your excellency, a question", author_id: `a${id}`, author: `user${id}`, author_bio: "", like_count: 0, conversation_id: `c${id}`, is_retweet: false, ...over };
};

function fakes(mentions: Mention[], pass: (id: string) => boolean = () => true) {
  const posted: { text: string; replyTo?: string }[] = [];
  const logs: string[] = [];
  const asked: string[][] = [];
  const llm: Llm = {
    writePosts: async () => [],
    writeBank: async () => [],
    writeReplies: async (i) => { asked.push(i.mentions.map((x) => x.id)); return i.mentions.map((x) => ({ mention_id: x.id, text: `Request denied, citizen ${x.id}.` })); },
    judge: async (items) => new Set(items.map((i) => i.id).filter(pass)),
  };
  const x: XClient = {
    me: async () => ({ id: "me", username: "PMBribo" }),
    mentions: async () => mentions,
    post: async (text, replyTo) => { posted.push({ text, replyTo }); return `r${posted.length}`; },
  };
  return { llm, x, posted, logs, asked, log: (l: string) => logs.push(l), examples: [] };
}

describe("looksUnder18", () => {
  it.each(["14 y/o", "im 15", "I'm 16 and bored", "minor", "under 18", "age: 13"])("flags %j", (t) => expect(looksUnder18(t)).toBe(true));
  it.each(["23 y/o", "since 2015", "18+", ""])("allows %j", (t) => expect(looksUnder18(t)).toBe(false));
});

describe("runReplyJob", () => {
  it("replies to the most-liked mentions, at most 3 per run", async () => {
    const config = setup();
    const ms = [m({ like_count: 1 }), m({ like_count: 9 }), m({ like_count: 5 }), m({ like_count: 7 }), m({ like_count: 0 })];
    const f = fakes(ms);
    expect(await runReplyJob({ config, ...f })).toBe(3);
    expect(f.posted.map((p) => p.replyTo)).toEqual([ms[1].id, ms[3].id, ms[2].id]);
    expect(readReplies(config.stateDir)).toHaveLength(3);
  });

  it("advances the cursor to the newest mention even when it skips some", async () => {
    const config = setup();
    const ms = [m({ id: "900" }), m({ id: "899" }), m({ id: "898" }), m({ id: "897" })];
    await runReplyJob({ config, ...fakes(ms) });
    expect(readCursor(config.stateDir).since_id).toBe("900");
  });

  it("keeps the decree counter when moving the cursor", async () => {
    const config = setup();
    writeCursor(config.stateDir, { since_id: null, decree: 7 });
    await runReplyJob({ config, ...fakes([m()]) });
    expect(readCursor(config.stateDir).decree).toBe(7);
  });

  it("applies the skip rules", async () => {
    const config = setup();
    const ms = [
      m({ is_retweet: true }),
      m({ author_id: "me" }),
      m({ text: "https://spam.example.com" }),
      m({ author_bio: "14 y/o gamer" }),
      m({ text: "who should win the election?" }),
      m({ text: "a perfectly normal question", like_count: 1 }),
    ];
    const f = fakes(ms);
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(f.asked[0]).toEqual([ms[5].id]);
  });

  it("caps replies at 15 per UTC day and 2 per author", async () => {
    const config = setup();
    for (let i = 0; i < 14; i++) appendReply(config.stateDir, { at: "2026-10-15T01:00:00Z", mention_id: `old${i}`, author_id: i < 2 ? "repeat" : `x${i}`, author: "u", conversation_id: `cc${i}`, text: "t", reply_id: "r" });
    const ms = [m({ author_id: "repeat" }), m(), m()];
    const f = fakes(ms);
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(f.asked[0]).not.toContain(ms[0].id);
  });

  it("stops after two replies in one conversation with the same author", async () => {
    const config = setup();
    for (let i = 0; i < 2; i++) appendReply(config.stateDir, { at: "2026-10-14T01:00:00Z", mention_id: `o${i}`, author_id: "loop", author: "u", conversation_id: "conv", text: "t", reply_id: "r" });
    const f = fakes([m({ author_id: "loop", conversation_id: "conv" })]);
    expect(await runReplyJob({ config, ...f })).toBe(0);
  });

  it("drops replies the judge fails", async () => {
    const config = setup();
    const a = m(); const b = m();
    const f = fakes([a, b], (id) => id === b.id);
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(f.posted[0].replyTo).toBe(b.id);
  });

  it("dry run posts nothing and leaves the cursor alone", async () => {
    const config = setup({ dryRun: true });
    const f = fakes([m()]);
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(f.posted).toEqual([]);
    expect(readCursor(config.stateDir).since_id).toBeNull();
    expect(readReplies(config.stateDir)).toEqual([]);
  });
});

describe("runReplyJob error paths", () => {
  it("skips a mention whose reply fails with a non-credit X error and keeps going", async () => {
    const config = setup();
    const a = m({ like_count: 5 }); const b = m({ like_count: 1 });
    const f = fakes([a, b]);
    const realPost = f.x.post;
    f.x.post = async (text, replyTo) => { if (replyTo === a.id) throw new XError("auth", "403 reply restricted"); return realPost(text, replyTo); };
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(readReplies(config.stateDir).map((r) => r.mention_id)).toEqual([b.id]);
    expect(readCursor(config.stateDir).since_id).toBe(newestOf([a.id, b.id]));
  });

  it("saves the cursor and then fails when every reply hits an auth error", async () => {
    const config = setup();
    const a = m();
    const f = fakes([a]);
    f.x.post = async () => { throw new XError("auth", "403 read-only token"); };
    await expect(runReplyJob({ config, ...f })).rejects.toThrow(/read-only/);
    expect(readCursor(config.stateDir).since_id).toBe(a.id);
  });

  it("rethrows credit errors after saving the cursor", async () => {
    const config = setup();
    const a = m();
    const f = fakes([a]);
    f.x.post = async () => { throw new XError("credits", "402"); };
    await expect(runReplyJob({ config, ...f })).rejects.toThrow("402");
    expect(readCursor(config.stateDir).since_id).toBe(a.id);
  });

  it("exits cleanly when reading mentions is rate limited", async () => {
    const config = setup();
    const f = fakes([]);
    f.x.mentions = async () => { throw new XError("rate_limit", "429"); };
    expect(await runReplyJob({ config, ...f })).toBe(0);
  });

  it("skips mentions that tag other accounts, so replies never pull in third parties", async () => {
    const config = setup();
    const ms = [m({ text: "@PMBribo @someoneelse look at this guy" }), m({ text: "@PMBribo hello your excellency" })];
    const f = fakes(ms);
    expect(await runReplyJob({ config, ...f })).toBe(1);
    expect(f.asked[0]).toEqual([ms[1].id]);
  });
});

function newestOf(ids: string[]) { return ids.reduce((a, b) => (BigInt(b) > BigInt(a) ? b : a)); }
