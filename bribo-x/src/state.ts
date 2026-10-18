import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Pillar } from "./pillars.js";

export type PostRecord = {
  at: string; slot: string; ids: string[]; parts: string[]; pillar: Pillar;
  source: "writer" | "bank"; headline_ref: string; bank_id?: string;
};
export type ReplyRecord = {
  at: string; mention_id: string; author_id: string; author: string;
  conversation_id: string; text: string; reply_id: string;
};
export type Cursor = { since_id: string | null; decree: number };
export type BankItem = { id: string; pillar: Pillar; text: string };

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
}

function appendJsonl(file: string, rec: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(rec) + "\n");
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export const readPosts = (d: string) => readJsonl<PostRecord>(path.join(d, "posted.jsonl"));
export const appendPost = (d: string, r: PostRecord) => appendJsonl(path.join(d, "posted.jsonl"), r);
export const readReplies = (d: string) => readJsonl<ReplyRecord>(path.join(d, "replied.jsonl"));
export const appendReply = (d: string, r: ReplyRecord) => appendJsonl(path.join(d, "replied.jsonl"), r);
export const readCursor = (d: string) => readJson<Cursor>(path.join(d, "cursor.json"), { since_id: null, decree: 0 });
export const writeCursor = (d: string, c: Cursor) => writeJson(path.join(d, "cursor.json"), c);
export const readBank = (contentDir: string) => readJson<BankItem[]>(path.join(contentDir, "bank.json"), []);
export const readBankUsed = (d: string) => readJson<string[]>(path.join(d, "bank-used.json"), []);

export function markBankUsed(d: string, id: string): void {
  const used = readBankUsed(d);
  if (!used.includes(id)) writeJson(path.join(d, "bank-used.json"), [...used, id]);
}
