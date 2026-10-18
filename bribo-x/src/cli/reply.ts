import { loadConfig } from "../config.js";
import { llmMode, makeLlm } from "../make-llm.js";
import { runReplyJob } from "../reply-job.js";
import { TwitterXClient } from "../x.js";
import { makeLog, readReplyExamples, readVoice } from "./common.js";

const config = loadConfig(process.env);
const { log, flush } = makeLog();
log(`Claude access: ${llmMode(process.env, config.now)}`);
try {
  const n = await runReplyJob({
    config,
    llm: makeLlm(process.env, config.now, readVoice(config.contentDir), log),
    x: new TwitterXClient(process.env),
    examples: readReplyExamples(config.contentDir),
    log,
  });
  log(`Replies: ${n}${config.dryRun ? " (dry run)" : ""}`);
} catch (e) {
  log(`FAILED: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  flush();
}
