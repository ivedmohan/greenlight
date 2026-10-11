import { describe, it, expect } from "vitest";
import { deepEqual } from "../src/compare.js";

describe("deepEqual", () => {
  it("compares primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
  });
  it("compares nested objects", () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toBe(false);
  });
  it("compares arrays", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
  });
  it("treats an array and a plain object with matching numeric keys as NOT equal", () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });
});
