import { describe, it, expect } from "vitest";
import { capitalize } from "../src/capitalize.js";

describe("capitalize", () => {
  it("uppercases the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
  it("leaves the rest of the string unchanged", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
  });
  it("handles single character strings", () => {
    expect(capitalize("a")).toBe("A");
  });
  it("handles empty strings", () => {
    expect(capitalize("")).toBe("");
  });
  it("does not duplicate the first character", () => {
    expect(capitalize("world")).not.toBe("Wworld");
    expect(capitalize("world").length).toBe("world".length);
  });
});
