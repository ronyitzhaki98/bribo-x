import { isBlockedHeadline } from "./blocklist.js";
import type { Config } from "./config.js";
import type { Llm } from "./llm.js";
import { deterministicReject } from "./safety.js";
import { appendReply, readCursor, readReplies, writeCursor } from "./state.js";
import { XError, type Mention, type XClient } from "./x.js";

export type ReplyDeps = {
  config: Config;
  llm: Llm;
  x: XClient;
  examples: { situation: string; mention: string; reply: string }[];
  log: (line: string) => void;
};

const PER_RUN = 3;
const PER_DAY = 15;
const PER_AUTHOR_DAY = 2;
const PER_CONVERSATION = 2;
const URL_TEST = /https?:\/\/\S+/;
const URL_ALL = /https?:\/\/\S+/g;

export function looksUnder18(text: string): boolean {
  return /\b1[0-7]\s*(y\/?o|yrs?|years?\s*old)\b|\b(i'?m|im|age:?)\s*1[0-7]\b|\bminor\b|\bunder\s*18\b|\bmiddle\s*school\b/i.test(text);
}

function newest(ids: string[]): string | null {
  return ids.reduce<string | null>((a, b) => (a === null || BigInt(b) > BigInt(a) ? b : a), null);
}

export async function runReplyJob(deps: ReplyDeps): Promise<number> {
  const { config, llm, x, log } = deps;
  const cursor = readCursor(config.stateDir);
  let me: { id: string; username: string };
  let mentions: Mention[];
  try {
    me = await x.me();
    mentions = await x.mentions(me.id, cursor.since_id);
  } catch (e) {
    if (e instanceof XError && e.kind === "rate_limit") { log("Rate limited reading mentions; trying next run."); return 0; }
    throw e;
  }
  log(`${mentions.length} new mentions.`);
  if (mentions.length === 0) return 0;
  // Move the cursor before replying, so a failure mid-run can never cause double replies.
  if (!config.dryRun) writeCursor(config.stateDir, { ...cursor, since_id: newest(mentions.map((mm) => mm.id)) });
  const ownHandle = new RegExp(`^@${me.username}$`, "i");

  const today = config.now.toISOString().slice(0, 10);
  const history = readReplies(config.stateDir);
  const todays = history.filter((r) => r.at.startsWith(today));
  const remaining = Math.max(0, PER_DAY - todays.length);

  const skip = (mm: Mention): string | null => {
    if (mm.is_retweet) return "retweet";
    if (mm.author_id === me.id) return "self";
    if (todays.filter((r) => r.author_id === mm.author_id).length >= PER_AUTHOR_DAY) return "author cap";
    if (history.filter((r) => r.conversation_id === mm.conversation_id && r.author_id === mm.author_id).length >= PER_CONVERSATION) return "conversation cap";
    if (URL_TEST.test(mm.text) && mm.text.replace(URL_ALL, "").replace(/@\w+/g, "").trim().length < 15) return "link only";
    if (looksUnder18(mm.author_bio) || looksUnder18(mm.text)) return "minor";
    if (isBlockedHeadline(mm.text)) return "blocked topic";
    // X would auto-tag every account in the chain, which could drag private users into the reply.
    if ((mm.text.match(/@\w{1,15}/g) ?? []).some((h) => !ownHandle.test(h))) return "tags others";
    return null;
  };

  const chosen = mentions
    .filter((mm) => {
      const reason = skip(mm);
      if (reason) log(`Skip ${mm.id} (${reason}).`);
      return !reason;
    })
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, Math.min(PER_RUN, remaining));

  let count = 0;
  let authFailures = 0;
  let lastAuth: XError | null = null;
  if (chosen.length) {
    const recentReplies = history.slice(-40).map((r) => r.text);
    let drafts: { mention_id: string; text: string }[] = [];
    try {
      drafts = await llm.writeReplies({
        mentions: chosen.map((mm) => ({ id: mm.id, author: mm.author, text: mm.text })),
        examples: deps.examples,
        recentReplies,
      });
    } catch (e) {
      log(`Writer failed: ${(e as Error).message}`);
    }
    const byId = new Map(chosen.map((mm) => [mm.id, mm]));
    const clean = drafts.filter((d) => {
      if (!byId.has(d.mention_id)) return false;
      const reason = deterministicReject(d.text, recentReplies);
      if (reason) log(`Rejected reply to ${d.mention_id} (${reason}): ${d.text}`);
      return !reason;
    });
    const passed = await llm.judge(clean.map((d) => ({ id: d.mention_id, text: d.text, context: byId.get(d.mention_id)!.text })));

    for (const d of clean) {
      if (!passed.has(d.mention_id)) { log(`Judge failed reply to ${d.mention_id}: ${d.text}`); continue; }
      const mm = byId.get(d.mention_id)!;
      if (config.dryRun) { log(`DRY RUN would reply to @${mm.author} ("${mm.text}"):\n${d.text}`); count++; continue; }
      try {
        const replyId = await x.post(d.text, mm.id);
        appendReply(config.stateDir, {
          at: config.now.toISOString(), mention_id: mm.id, author_id: mm.author_id, author: mm.author,
          conversation_id: mm.conversation_id, text: d.text, reply_id: replyId,
        });
        log(`Replied to @${mm.author}: ${d.text}`);
        count++;
      } catch (e) {
        if (!(e instanceof XError) || e.kind === "credits") throw e;
        if (e.kind === "rate_limit") { log("Rate limited."); break; }
        // A 403 on one mention (replies restricted, tweet deleted) must not stop the others.
        if (e.kind === "auth") { authFailures++; lastAuth = e; }
        log(`Reply to ${mm.id} failed (${e.kind}): ${e.message}`);
      }
    }
  }

  // Every reply refused with auth errors means the token itself is broken: fail loudly.
  if (lastAuth && count === 0 && authFailures > 0) throw lastAuth;
  return count;
}
