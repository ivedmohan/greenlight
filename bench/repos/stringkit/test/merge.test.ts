import { describe, it, expect } from "vitest";
import { merge } from "../src/merge.js";

describe("merge", () => {
  it("shallow merges two plain objects", () => {
    expect(merge({ a: 1, b: 1 }, { b: 2, c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });
  it("rejects arrays as inputs", () => {
    expect(() => merge([1, 2] as unknown as object, { a: 1 })).toThrow();
  });
  it("rejects null as an input", () => {
    expect(() => merge(null as unknown as object, { a: 1 })).toThrow();
  });
});
