import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBankJob } from "../bank-job.js";
import { loadConfig } from "../config.js";
import { makeLlm } from "../make-llm.js";
import { makeLog, readVoice } from "./common.js";

const config = loadConfig(process.env);
const { log, flush } = makeLog();
const total = Number(process.env.BANK_TOTAL ?? "1000");
const out = await runBankJob({ llm: makeLlm(process.env, config.now, readVoice(config.contentDir), log), total, batch: 25, log });
mkdirSync(config.outDir, { recursive: true });
writeFileSync(path.join(config.outDir, "bank-candidates.json"), JSON.stringify(out, null, 2));
log(`Wrote ${out.length} candidates.`);
flush();
