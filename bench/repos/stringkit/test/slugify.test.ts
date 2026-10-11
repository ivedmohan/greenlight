import { describe, it, expect } from "vitest";
import { slugify } from "../src/slugify.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("collapses punctuation into a single hyphen", () => {
    expect(slugify("Hello,   World!!")).toBe("hello-world");
  });
  it("preserves digits", () => {
    expect(slugify("Top 10 Agents")).toBe("top-10-agents");
  });
  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Leading and trailing-  ")).toBe("leading-and-trailing");
  });
});
