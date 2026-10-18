import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

export function makeLog() {
  const lines: string[] = [];
  return {
    log: (l: string) => { lines.push(l); console.log(l); },
    flush: () => {
      const file = process.env.GITHUB_STEP_SUMMARY;
      if (file) appendFileSync(file, "```\n" + lines.join("\n") + "\n```\n");
    },
  };
}

export const readVoice = (contentDir: string) => readFileSync(path.join(contentDir, "voice.md"), "utf8");

export const readReplyExamples = (contentDir: string) =>
  JSON.parse(readFileSync(path.join(contentDir, "replies.json"), "utf8")) as { situation: string; mention: string; reply: string }[];
