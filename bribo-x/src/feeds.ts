import { XMLParser } from "fast-xml-parser";
import { isBlockedHeadline } from "./blocklist.js";
import { normalize } from "./text.js";

export type Headline = { title: string; source: string; published: number };

export const FEEDS: { url: string; source: string }[] = [
  { url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", source: "google-top" },
  { url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en", source: "google-tech" },
  { url: "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en", source: "google-entertainment" },
  { url: "https://trends.google.com/trending/rss?geo=US", source: "google-trends" },
  { url: "https://hnrss.org/frontpage", source: "hacker-news" },
];

const parser = new XMLParser({ ignoreAttributes: true });

export function parseRss(xml: string, source: string): Headline[] {
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const raw = (doc as { rss?: { channel?: { item?: unknown } } })?.rss?.channel?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.flatMap((it) => {
    const item = it as { title?: unknown; pubDate?: unknown };
    if (typeof item.title !== "string" && typeof item.title !== "number") return [];
    const rawTitle = String(item.title).trim();
    const title = source.startsWith("google") ? rawTitle.replace(/\s+-\s+[^-]+$/, "").trim() : rawTitle;
    const published = typeof item.pubDate === "string" ? Date.parse(item.pubDate) || 0 : 0;
    return title ? [{ title, source, published }] : [];
  });
}

export async function fetchHeadlines(fetchFn: typeof fetch, limit = 25): Promise<Headline[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const res = await fetchFn(f.url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`${f.source}: ${res.status}`);
      return parseRss(await res.text(), f.source);
    }),
  );
  const seen = new Set<string>();
  const all: Headline[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const h of r.value) {
      const key = normalize(h.title);
      if (seen.has(key) || isBlockedHeadline(h.title)) continue;
      seen.add(key);
      all.push(h);
    }
  }
  return all.sort((a, b) => b.published - a.published).slice(0, limit);
}
