import { z } from "zod";
import { isBlockedOutput } from "./blocklist.js";
import { maxSimilarity, weightedLength } from "./text.js";

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ly|gg|tv|me|app|xyz|ai|dev)\b)/i;
const MENTION_RE = /(^|[^\w])@\w{1,15}/;
const HASHTAG_RE = /(^|\s)#\w+/g;
const MONEY_RE = /\b(donate|donation|paypal|venmo|cash ?app|patreon|onlyfans|ko-?fi|crypto wallet|giveaway)\b/i;

export function deterministicReject(text: string, recentTexts: string[]): string | null {
  if (!text.trim()) return "empty";
  if (weightedLength(text) > 280) return "too long";
  if (URL_RE.test(text)) return "url";
  if (MENTION_RE.test(text)) return "mention";
  if ((text.match(HASHTAG_RE) ?? []).length > 1) return "hashtags";
  if (isBlockedOutput(text)) return "blocklist";
  if (MONEY_RE.test(text)) return "money";
  if (maxSimilarity(text, recentTexts) >= 0.5) return "duplicate";
  return null;
}

export type Verdict = { id: string; verdict: "pass" | "fail"; reason: string };

const VerdictsSchema = z.object({
  verdicts: z.array(z.object({ id: z.string(), verdict: z.enum(["pass", "fail"]), reason: z.string().default("") })),
});

export function passedIds(verdicts: unknown, ids: string[]): Set<string> {
  const parsed = VerdictsSchema.safeParse(verdicts);
  if (!parsed.success) return new Set();
  const asked = new Set(ids);
  return new Set(parsed.data.verdicts.filter((v) => v.verdict === "pass" && asked.has(v.id)).map((v) => v.id));
}
