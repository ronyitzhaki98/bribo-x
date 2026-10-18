import { describe, expect, it } from "vitest";
import { TwitterXClient, classifyXError } from "../src/x.js";

describe("classifyXError", () => {
  it.each([
    [402, "", "credits"],
    [403, "You are not allowed to create a Tweet with duplicate content.", "duplicate"],
    [403, "Your client app is not configured with the appropriate oauth1 app permissions", "auth"],
    [401, "Unauthorized", "auth"],
    [429, "Too Many Requests", "rate_limit"],
    [500, "oops", "other"],
  ])("%i %j -> %s", (status, detail, kind) => {
    expect(classifyXError(status, detail)).toBe(kind);
  });
});

describe("TwitterXClient", () => {
  it("refuses to start without all four secrets", () => {
    expect(() => new TwitterXClient({ X_API_KEY: "a" })).toThrow(/X_API_SECRET/);
  });
});
