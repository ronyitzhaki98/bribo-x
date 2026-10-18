import type { Config } from "./config.js";
import type { Headline } from "./feeds.js";
import type { Candidate, Llm } from "./llm.js";
import { pickPillar } from "./pillars.js";
import { dayKeyFor, planDay, slotFor, slotKey } from "./plan.js";
import { deterministicReject } from "./safety.js";
import {
  appendPost, markBankUsed, readBank, readBankUsed, readCursor, readPosts, writeCursor, type PostRecord,
} from "./state.js";
import { XError, type XClient } from "./x.js";

export type PostDeps = {
  config: Config;
  llm: Llm;
  x: XClient;
  headlines: () => Promise<Headline[]>;
  log: (line: string) => void;
};

type Pick = { parts: string[]; pillar: PostRecord["pillar"]; headline_ref: string; source: "writer" | "bank"; bank_id?: string };

export async function runPostJob(deps: PostDeps): Promise<"skipped" | "posted" | "dry-run" | "nothing"> {
  const { config, llm, x, log } = deps;
  const now = config.now;
  let slot = slotFor(now);
  if (!config.forceSlot) {
    if (!slot || !planDay(slot.dayKey).slots.includes(slot.index)) {
      log(`Not a posting slot (${slot ? slotKey(slot) : "outside window"}).`);
      return "skipped";
    }
  }
  slot ??= { dayKey: dayKeyFor(now), index: -1 };
  const key = slotKey(slot);
  const history = readPosts(config.stateDir);
  if (!config.forceSlot && slot.index >= 0 && history.some((r) => r.slot === key)) {
    log(`Slot ${key} already posted.`);
    return "skipped";
  }

  const recentTexts = history.slice(-200).flatMap((r) => r.parts);
  const allowThread = !history.some((r) => r.parts.length > 1 && r.slot.startsWith(slot!.dayKey));
  const cursor = readCursor(config.stateDir);
  const pillar = pickPillar(history, now);
  const headlines = await deps.headlines().catch(() => [] as Headline[]);
  log(`Slot ${key}, pillar ${pillar}, ${headlines.length} headlines, threads ${allowThread ? "allowed" : "off"}.`);

  let candidates: Candidate[] = [];
  try {
    candidates = await llm.writePosts({
      today: dayKeyFor(now), pillar, headlines, recent: recentTexts.slice(-40),
      decreeNumber: cursor.decree + 1, allowThread,
    });
  } catch (e) {
    log(`Writer failed: ${(e as Error).message}`);
  }

  const survivors = candidates.filter((c) => {
    if (c.parts.length > 1 && !allowThread) return false;
    const reasons = c.parts.map((p) => deterministicReject(p, recentTexts));
    const bad = reasons.find((r) => r !== null);
    if (bad) log(`Rejected (${bad}): ${c.parts.join(" / ")}`);
    return !bad;
  });

  const items = survivors.flatMap((c, ci) =>
    c.parts.map((text, pi) => ({ id: `${ci}.${pi}`, text, ...(c.headline_ref ? { headline: c.headline_ref } : {}) })),
  );
  const passed = await llm.judge(items);
  const picks: Pick[] = survivors
    .filter((c, ci) => {
      const ok = c.parts.every((_, pi) => passed.has(`${ci}.${pi}`));
      if (!ok) log(`Judge failed: ${c.parts.join(" / ")}`);
      return ok;
    })
    .map((c) => ({ ...c, source: "writer" as const }));

  const used = new Set(readBankUsed(config.stateDir));
  const bankItem = readBank(config.contentDir).find((b) => !used.has(b.id) && deterministicReject(b.text, recentTexts) === null);
  if (bankItem) picks.push({ parts: [bankItem.text], pillar: bankItem.pillar, headline_ref: "", source: "bank", bank_id: bankItem.id });

  for (const pick of picks) {
    if (config.dryRun) {
      log(`DRY RUN would post (${pick.source}, ${pick.pillar}):\n${pick.parts.join("\n---\n")}`);
      return "dry-run";
    }
    const ids: string[] = [];
    const record = () => {
      appendPost(config.stateDir, {
        at: now.toISOString(), slot: key, ids, parts: pick.parts.slice(0, ids.length), pillar: pick.pillar,
        source: pick.source, headline_ref: pick.headline_ref, ...(pick.bank_id ? { bank_id: pick.bank_id } : {}),
      });
      if (pick.bank_id) markBankUsed(config.stateDir, pick.bank_id);
    };
    try {
      for (const part of pick.parts) ids.push(await x.post(part, ids.at(-1)));
    } catch (e) {
      if (ids.length > 0) {
        record();
        log(`Thread broke after ${ids.length} part(s); recorded what was posted.`);
        throw e;
      }
      if (e instanceof XError && e.kind === "duplicate" && ids.length === 0) {
        log(`Duplicate, trying next: ${pick.parts[0]}`);
        continue;
      }
      if (e instanceof XError && e.kind === "rate_limit") {
        log("Rate limited; giving up this slot.");
        return "nothing";
      }
      throw e;
    }
    record();
    const decrees = pick.parts.flatMap((p) => [...p.matchAll(/DECREE #(\d+)/gi)].map((m) => Number(m[1])));
    if (decrees.length) writeCursor(config.stateDir, { ...cursor, decree: Math.max(cursor.decree, ...decrees) });
    log(`Posted (${pick.source}): ${pick.parts.join(" / ")}`);
    return "posted";
  }
  log("Nothing to post.");
  return "nothing";
}
