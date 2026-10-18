import { describe, expect, it, vi } from "vitest";
import { FEEDS, fetchHeadlines, parseRss } from "../src/feeds.js";

const GOOGLE = `<?xml version="1.0"?><rss><channel>
<item><title>Phone maker adds ninth camera - The Verge</title><pubDate>Wed, 15 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Storm death toll rises - Reuters</title><pubDate>Wed, 15 Oct 2026 11:00:00 GMT</pubDate></item>
</channel></rss>`;

const SINGLE = `<rss><channel><item><title>Only one</title></item></channel></rss>`;

describe("parseRss", () => {
  it("parses items and strips the Google News publisher suffix", () => {
    const items = parseRss(GOOGLE, "google-top");
    expect(parseRss(GOOGLE.replace("Phone maker", "Show HN"), "hacker-news")[0].title).toBe("Show HN adds ninth camera - The Verge");
    expect(items.map((i) => i.title)).toEqual(["Phone maker adds ninth camera", "Storm death toll rises"]);
    expect(items[0].published).toBe(Date.parse("Wed, 15 Oct 2026 10:00:00 GMT"));
  });
  it("handles a single item and missing dates", () => {
    expect(parseRss(SINGLE, "x")).toEqual([{ title: "Only one", source: "x", published: 0 }]);
  });
  it("returns [] for garbage", () => {
    expect(parseRss("not xml", "x")).toEqual([]);
  });
});

describe("fetchHeadlines", () => {
  it("merges feeds, drops blocked and duplicate titles, newest first, survives failures", async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === FEEDS[0].url) return new Response(GOOGLE);
      if (url === FEEDS[1].url) return new Response(GOOGLE);
      throw new Error("down");
    }) as unknown as typeof fetch;
    const out = await fetchHeadlines(fetchFn);
    expect(out.map((h) => h.title)).toEqual(["Phone maker adds ninth camera"]);
  });
  it("respects the limit", async () => {
    const many = `<rss><channel>${Array.from({ length: 40 }, (_, i) => `<item><title>Gadget news ${i} alpha${i}</title></item>`).join("")}</channel></rss>`;
    const fetchFn = (async () => new Response(many)) as unknown as typeof fetch;
    expect((await fetchHeadlines(fetchFn, 25)).length).toBe(25);
  });
});
