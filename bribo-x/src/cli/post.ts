import { loadConfig } from "../config.js";
import { fetchHeadlines } from "../feeds.js";
import { llmMode, makeLlm } from "../make-llm.js";
import { runPostJob } from "../post-job.js";
import { TwitterXClient } from "../x.js";
import { makeLog, readVoice } from "./common.js";

const config = loadConfig(process.env);
const { log, flush } = makeLog();
log(`Claude access: ${llmMode(process.env, config.now)}`);
try {
  const result = await runPostJob({
    config,
    llm: makeLlm(process.env, config.now, readVoice(config.contentDir), log),
    x: new TwitterXClient(process.env),
    headlines: () => fetchHeadlines(fetch),
    log,
  });
  log(`Result: ${result}${config.dryRun ? " (dry run)" : ""}`);
} catch (e) {
  log(`FAILED: ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  flush();
}
