import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("is live when BRIBO_X_PAUSED=false", () => {
    const c = loadConfig({ BRIBO_X_PAUSED: "false" }, new Date("2026-10-15T12:00:00Z"), "/r");
    expect(c.dryRun).toBe(false);
    expect(c.forceSlot).toBe(false);
    expect(c.stateDir).toBe("/r/state");
  });
  it("treats BRIBO_X_DRY_RUN=true as dry run", () => {
    expect(loadConfig({ BRIBO_X_PAUSED: "false", BRIBO_X_DRY_RUN: "true" }).dryRun).toBe(true);
  });
  it("forces dry run while paused", () => {
    expect(loadConfig({ BRIBO_X_PAUSED: "true" }).dryRun).toBe(true);
  });
  it("reads FORCE_SLOT", () => {
    expect(loadConfig({ FORCE_SLOT: "true" }).forceSlot).toBe(true);
  });
});

describe("loadConfig fail-safe", () => {
  it("is a dry run unless BRIBO_X_PAUSED is explicitly false", () => {
    expect(loadConfig({}).dryRun).toBe(true);
    expect(loadConfig({ BRIBO_X_PAUSED: "False " }).dryRun).toBe(true);
    expect(loadConfig({ BRIBO_X_PAUSED: "false" }).dryRun).toBe(false);
  });
  it("always dry-runs a forced slot", () => {
    expect(loadConfig({ BRIBO_X_PAUSED: "false", FORCE_SLOT: "true" }).dryRun).toBe(true);
  });
});
