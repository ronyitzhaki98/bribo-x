import type { Llm } from "./llm.js";
import { PILLARS, PILLAR_LIST, type Pillar } from "./pillars.js";
import { deterministicReject } from "./safety.js";

export async function runBankJob(deps: { llm: Llm; total: number; batch: number; log: (l: string) => void }) {
  const accepted: { pillar: Pillar; text: string }[] = [];
  for (const pillar of PILLAR_LIST) {
    const want = Math.round((deps.total * PILLARS[pillar]) / 100);
    let produced = 0;
    while (produced < want) {
      const count = Math.min(deps.batch, want - produced);
      produced += count;
      let texts: string[] = [];
      try {
        texts = await deps.llm.writeBank({ pillar, count, avoid: accepted.filter((a) => a.pillar === pillar).slice(-30).map((a) => a.text) });
      } catch (e) {
        deps.log(`Batch failed for ${pillar}: ${(e as Error).message}`);
        continue;
      }
      for (const text of texts) {
        if (deterministicReject(text, accepted.map((a) => a.text)) === null) accepted.push({ pillar, text });
      }
      deps.log(`${pillar}: ${accepted.filter((a) => a.pillar === pillar).length}/${want}`);
    }
  }
  return accepted;
}
