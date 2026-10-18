import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendPost, appendReply, markBankUsed, readBank, readBankUsed, readCursor, readPosts, readReplies, writeCursor,
  type PostRecord,
} from "../src/state.js";

const dir = () => mkdtempSync(path.join(tmpdir(), "bribo-"));

const post: PostRecord = {
  at: "2026-10-15T12:17:00Z", slot: "2026-10-15#1", ids: ["1"], parts: ["hi"], pillar: "news", source: "writer", headline_ref: "",
};

describe("state", () => {
  it("returns empty defaults when files are missing", () => {
    const d = dir();
    expect(readPosts(d)).toEqual([]);
    expect(readReplies(d)).toEqual([]);
    expect(readCursor(d)).toEqual({ since_id: null, decree: 0 });
    expect(readBankUsed(d)).toEqual([]);
  });
  it("appends and reads posts and replies in order", () => {
    const d = dir();
    appendPost(d, post);
    appendPost(d, { ...post, ids: ["2"] });
    expect(readPosts(d).map((p) => p.ids[0])).toEqual(["1", "2"]);
    appendReply(d, { at: "x", mention_id: "m", author_id: "a", author: "u", conversation_id: "c", text: "t", reply_id: "r" });
    expect(readReplies(d)).toHaveLength(1);
  });
  it("skips blank lines in jsonl", () => {
    const d = dir();
    writeFileSync(path.join(d, "posted.jsonl"), `\n${JSON.stringify(post)}\n\n`);
    expect(readPosts(d)).toHaveLength(1);
  });
  it("round-trips the cursor and bank-used list", () => {
    const d = dir();
    writeCursor(d, { since_id: "99", decree: 4 });
    expect(readCursor(d)).toEqual({ since_id: "99", decree: 4 });
    markBankUsed(d, "b1");
    markBankUsed(d, "b1");
    expect(readBankUsed(d)).toEqual(["b1"]);
  });
  it("reads the bank", () => {
    const d = dir();
    writeFileSync(path.join(d, "bank.json"), JSON.stringify([{ id: "b1", pillar: "news", text: "x" }]));
    expect(readBank(d)).toEqual([{ id: "b1", pillar: "news", text: "x" }]);
  });
});
