import { describe, it, expect } from "vitest";
import { chunk, unique, flattenDeep } from "../src/arrays.js";

describe("chunk", () => {
  it("splits an array into chunks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one chunk if size >= length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("unique", () => {
  it("removes duplicate primitives", () => {
    expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
  });
  it("preserves order of first occurrence", () => {
    expect(unique(["b", "a", "b", "c"])).toEqual(["b", "a", "c"]);
  });
});

describe("flattenDeep", () => {
  it("flattens nested arrays completely", () => {
    expect(flattenDeep([1, [2, [3, [4, 5]], 6]])).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("returns a flat array unchanged", () => {
    expect(flattenDeep([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
