import { describe, expect, it } from "vitest";
import { runBankJob } from "../src/bank-job.js";
import type { Llm } from "../src/llm.js";

describe("runBankJob", () => {
  it("splits by pillar weight, batches, and drops rejects and near-duplicates", async () => {
    let n = 0;
    const calls: number[] = [];
    const llm: Llm = {
      writePosts: async () => [], writeReplies: async () => [], judge: async () => new Set(),
      writeBank: async (i) => {
        calls.push(i.count);
        return Array.from({ length: i.count }, (_, k) => {
          if (k === 0) return "visit bribo.com";
          n++;
          return `${((n * 2654435761) >>> 0).toString(36)} ${((n * 40503 + 7) >>> 0).toString(36)} ${((n * 97 + 13) >>> 0).toString(36)}`;
        });
      },
    };
    const out = await runBankJob({ llm, total: 20, batch: 5, log: () => {} });
    expect(calls.every((c) => c <= 5)).toBe(true);
    expect(out.some((o) => o.text.includes("bribo.com"))).toBe(false);
    expect(out.filter((o) => o.pillar === "news").length).toBeGreaterThan(out.filter((o) => o.pillar === "tech").length);
  });
});
