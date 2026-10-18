export const SLOT_HOURS = [10, 12, 14, 16, 18, 20, 22, 0, 2, 4] as const;
const DAY_OFFSET_MS = 6 * 3600_000;
const TOLERANCE_MS = 90 * 60_000;
// Weights for targets 2..10 (mean ≈ 5.6).
const TARGET_WEIGHTS = [1, 2, 3, 4, 4, 3, 2, 1, 1];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayKeyFor(now: Date): string {
  return new Date(now.getTime() - DAY_OFFSET_MS).toISOString().slice(0, 10);
}

export function planDay(dayKey: string): { target: number; slots: number[] } {
  const rand = mulberry32(hash(`bribo:${dayKey}`));
  const total = TARGET_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let target = 2;
  for (let i = 0; i < TARGET_WEIGHTS.length; i++) {
    r -= TARGET_WEIGHTS[i];
    if (r < 0) { target = i + 2; break; }
  }
  const idx = SLOT_HOURS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { target, slots: idx.slice(0, target).sort((a, b) => a - b) };
}

function slotTime(dayKey: string, index: number): number {
  const base = Date.parse(`${dayKey}T00:00:00Z`);
  const hour = SLOT_HOURS[index];
  const dayShift = hour < 6 ? 24 : 0;
  return base + (hour + dayShift) * 3600_000 + 17 * 60_000;
}

export function slotFor(now: Date): { dayKey: string; index: number } | null {
  const t = now.getTime();
  const candidates = [dayKeyFor(now), dayKeyFor(new Date(t - 86400_000))];
  let best: { dayKey: string; index: number; diff: number } | null = null;
  for (const dayKey of candidates) {
    for (let index = 0; index < SLOT_HOURS.length; index++) {
      const diff = Math.abs(t - slotTime(dayKey, index));
      if (diff <= TOLERANCE_MS && (!best || diff < best.diff)) best = { dayKey, index, diff };
    }
  }
  return best ? { dayKey: best.dayKey, index: best.index } : null;
}

export function slotKey(s: { dayKey: string; index: number }): string {
  return `${s.dayKey}#${s.index}`;
}
