export type Pillar = "news" | "tiktokistan" | "doomscrollers" | "x_platform" | "tech" | "human_nature";

export const PILLARS: Record<Pillar, number> = {
  news: 35,
  tiktokistan: 20,
  doomscrollers: 15,
  x_platform: 10,
  tech: 10,
  human_nature: 10,
};

export const PILLAR_LIST = Object.keys(PILLARS) as Pillar[];

const WEEK_MS = 7 * 86400_000;

export function pickPillar(recent: { at: string; pillar: Pillar }[], now: Date): Pillar {
  const window = recent.filter((r) => now.getTime() - Date.parse(r.at) <= WEEK_MS);
  const total = window.length;
  let best: Pillar = PILLAR_LIST[0];
  let bestDeficit = -Infinity;
  for (const p of PILLAR_LIST) {
    const actual = total === 0 ? 0 : window.filter((r) => r.pillar === p).length / total;
    const deficit = PILLARS[p] / 100 - actual;
    if (deficit > bestDeficit) { best = p; bestDeficit = deficit; }
  }
  return best;
}
