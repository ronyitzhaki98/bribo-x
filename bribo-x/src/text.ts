// X counts most code points as 2; these ranges count as 1 (twitter-text v3 config).
const LIGHT_RANGES: Array<[number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

export function weightedLength(text: string): number {
  let total = 0;
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    total += LIGHT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? 1 : 2;
  }
  return total;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(text: string): Set<string> {
  const s = normalize(text);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 && tb.size === 0) return normalize(a) === normalize(b) ? 1 : 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function maxSimilarity(text: string, others: string[]): number {
  return others.reduce((m, o) => Math.max(m, similarity(text, o)), 0);
}
