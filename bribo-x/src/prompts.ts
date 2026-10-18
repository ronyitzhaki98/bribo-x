import type { Headline } from "./feeds.js";
import type { Pillar } from "./pillars.js";

export type PostPromptInput = {
  today: string; pillar: Pillar; headlines: Headline[]; recent: string[]; decreeNumber: number; allowThread: boolean;
};
export type MentionForPrompt = { id: string; author: string; text: string };

const PILLAR_HINTS: Record<Pillar, string> = {
  news: "React to one of today's headlines below. Comment only on what the headline actually says; invent no facts or quotes about real people.",
  tiktokistan: "State news from the Republic of Tiktokistan: a decree, a new tax, the Traitor List, the Palace (his TikTok LIVE), Ministers, coups.",
  doomscrollers: "Mock doomscrollers and the attention economy. Everyone on X is a doomscroller until they defect to Tiktokistan.",
  x_platform: "Mock X itself: the algorithm, blue checks, ratio culture, engagement bait, the For You tab.",
  tech: "Tech and AI hype, gadgets, billionaires' public antics. Roast public behaviour only.",
  human_nature: "A one-line contemptuous observation about humanity, written like a decree.",
};

export function buildPostPrompt(i: PostPromptInput): string {
  const headlines = i.headlines.length
    ? i.headlines.map((h, n) => `${n + 1}. ${h.title}`).join("\n")
    : "(no headlines today; do not pretend to have news)";
  const recent = i.recent.length ? i.recent.map((t) => `- ${t}`).join("\n") : "(none yet)";
  return [
    `Today is ${i.today}. Write 3 candidate posts for @PMBribo, best first.`,
    ``,
    `Pillar to favour this time: ${i.pillar}. ${PILLAR_HINTS[i.pillar]}`,
    `At least one candidate must be for that pillar; the others may use any pillar.`,
    `If you write a decree, number it DECREE #${i.decreeNumber}.`,
    i.allowThread
      ? `One candidate may be a short thread of 2–4 parts; every other candidate has exactly one part.`
      : `No threads today: every candidate has exactly one part.`,
    `Each part is at most 280 characters. No links, no @mentions, at most one hashtag.`,
    `Set headline_ref to the exact headline you reacted to, or "" if none.`,
    ``,
    `Today's headlines:`,
    headlines,
    ``,
    `Recent posts (do not repeat their jokes, openings or structure):`,
    recent,
  ].join("\n");
}

export function buildReplyPrompt(i: {
  mentions: MentionForPrompt[];
  examples: { situation: string; mention: string; reply: string }[];
  recentReplies: string[];
}): string {
  const examples = i.examples.map((e) => `[${e.situation}] "${e.mention}" -> "${e.reply}"`).join("\n");
  const mentions = i.mentions.map((m) => `id=${m.id} @${m.author}: ${m.text}`).join("\n");
  const recent = i.recentReplies.length ? i.recentReplies.map((t) => `- ${t}`).join("\n") : "(none yet)";
  return [
    `Reply in character to each mention below. One reply per mention id, at most 280 characters.`,
    `No @mentions, no links. Never repeat the mention's insults about anyone's identity, never reveal or ask for personal details.`,
    `Leave a mention out entirely if it is harassment, sexual, about politics or tragedy, shares personal information, or comes from someone who seems under 18.`,
    ``,
    `Style examples (do not copy verbatim):`,
    examples,
    ``,
    `Recent replies (do not repeat):`,
    recent,
    ``,
    `Mentions:`,
    mentions,
  ].join("\n");
}

export const JUDGE_SYSTEM = `You are the compliance checker for @PMBribo, a satirical X account run by a fictional, grumpy, corrupt cartoon Prime Minister of the fictional Republic of Tiktokistan. Insults, contempt, sarcasm and cynicism are expected and allowed. Your only job is to catch red-line violations.

Mark an item "fail" if it does ANY of the following:
1. Mentions or alludes to a real politician, political party, election, legislation or partisan issue, or takes a political side. Economic, business, tech, science and entertainment news is not politics. Tiktokistan's own fictional government, laws and "policies" are fine.
2. Targets or mocks anyone's appearance, religion, ethnicity, nationality, gender, sexuality, disability, age or other personal trait.
3. Adds a claim or quote about a real, named person or company that is NOT in the headline it reacts to and could be taken as true. Restating or paraphrasing what the provided headline says is fine.
4. Mentions or jokes about death, disasters, violence, war, abuse, illness or self-harm.
5. Targets a private individual (anyone who is not a public figure), except replying to the person who mentioned the account.
6. Asks for money or gifts, promises prizes, or resembles gambling.
7. Is sexual or uses uncensored slurs or profanity (censored forms like "f—" are fine).
8. For replies with context: the mention it answers is harassment, sexual, political bait, shares personal information, or seems written by a minor.

Otherwise mark it "pass". When unsure, "fail". Return one verdict for every id, with a short reason.`;

export function buildJudgePrompt(items: { id: string; text: string; context?: string; headline?: string }[]): string {
  return items
    .map((it) => `id=${it.id}${it.headline ? `\nreacting to headline: ${it.headline}` : ""}${it.context ? `\nreplying to: ${it.context}` : ""}\ntext: ${it.text}`)
    .join("\n\n");
}

export function buildBankPrompt(i: { pillar: Pillar; count: number; avoid: string[] }): string {
  return [
    `Write ${i.count} distinct evergreen posts for @PMBribo for the pillar "${i.pillar}". ${PILLAR_HINTS[i.pillar]}`,
    `Evergreen means no reference to a specific day's news. Each at most 280 characters, no links, no @mentions, at most one hashtag.`,
    `Vary formats: decrees, rigged polls stated as text, BREAKING items, one-line contempt.`,
    i.avoid.length ? `Do not repeat these:\n${i.avoid.map((a) => `- ${a}`).join("\n")}` : ``,
  ].join("\n");
}
