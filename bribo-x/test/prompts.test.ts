import { describe, expect, it } from "vitest";
import { JUDGE_SYSTEM, buildBankPrompt, buildJudgePrompt, buildPostPrompt, buildReplyPrompt } from "../src/prompts.js";

describe("prompts", () => {
  it("post prompt carries pillar, headlines, recent posts, decree number and thread rule", () => {
    const p = buildPostPrompt({
      today: "2026-10-15", pillar: "tech",
      headlines: [{ title: "Phone gets ninth camera", source: "google-tech", published: 0 }],
      recent: ["old post"], decreeNumber: 7, allowThread: false,
    });
    expect(p).toContain("tech");
    expect(p).toContain("Phone gets ninth camera");
    expect(p).toContain("old post");
    expect(p).toContain("DECREE #7");
    expect(p).toMatch(/no threads/i);
  });
  it("post prompt says when there are no headlines", () => {
    const p = buildPostPrompt({ today: "d", pillar: "news", headlines: [], recent: [], decreeNumber: 1, allowThread: true });
    expect(p).toMatch(/no headlines/i);
  });
  it("reply prompt lists mention ids and examples", () => {
    const p = buildReplyPrompt({
      mentions: [{ id: "m1", author: "bob", text: "is this AI?" }],
      examples: [{ situation: "is this AI", mention: "r u a bot", reply: "I am a Prime Minister." }],
      recentReplies: [],
    });
    expect(p).toContain("m1");
    expect(p).toContain("@bob");
    expect(p).toContain("I am a Prime Minister.");
  });
  it("judge prompt includes every id and the red lines live in the system prompt", () => {
    const p = buildJudgePrompt([{ id: "0.0", text: "a" }, { id: "1.0", text: "b", context: "mention text" }]);
    expect(p).toContain("0.0");
    expect(p).toContain("mention text");
    expect(JUDGE_SYSTEM).toMatch(/politic/i);
    expect(JUDGE_SYSTEM).toMatch(/fail/i);
  });
  it("bank prompt asks for the count and lists things to avoid", () => {
    const p = buildBankPrompt({ pillar: "doomscrollers", count: 25, avoid: ["dup"] });
    expect(p).toContain("25");
    expect(p).toContain("dup");
  });
});

describe("judge context", () => {
  it("shows the headline a post reacts to and allows restating it", () => {
    const p = buildJudgePrompt([{ id: "0.0", text: "t", headline: "Phone maker adds ninth camera" }]);
    expect(p).toContain("reacting to headline: Phone maker adds ninth camera");
    expect(JUDGE_SYSTEM).toMatch(/restat/i);
    expect(JUDGE_SYSTEM).toMatch(/economic|business/i);
  });
});
