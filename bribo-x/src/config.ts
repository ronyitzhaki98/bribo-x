import { fileURLToPath } from "node:url";
import path from "node:path";

export type Config = {
  dryRun: boolean;
  forceSlot: boolean;
  stateDir: string;
  contentDir: string;
  outDir: string;
  now: Date;
};

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(
  env: Record<string, string | undefined>,
  now: Date = new Date(),
  root: string = PACKAGE_ROOT,
): Config {
  // Fail closed: live only when BRIBO_X_PAUSED is explicitly "false"; a forced slot is always a preview.
  const live = env.BRIBO_X_PAUSED === "false";
  const forceSlot = env.FORCE_SLOT === "true";
  return {
    dryRun: !live || forceSlot || env.BRIBO_X_DRY_RUN === "true",
    forceSlot,
    stateDir: path.posix.join(root.replaceAll("\\", "/"), "state"),
    contentDir: path.posix.join(root.replaceAll("\\", "/"), "content"),
    outDir: path.posix.join(root.replaceAll("\\", "/"), "out"),
    now,
  };
}
