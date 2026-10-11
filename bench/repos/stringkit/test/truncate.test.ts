import { describe, it, expect } from "vitest";
import { truncate } from "../src/truncate.js";

describe("truncate", () => {
  it("returns the string unchanged if within maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates and appends an ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });
  it("returns a string of exactly maxLen when truncated", () => {
    expect(truncate("hello world", 8).length).toBe(8);
  });
});
