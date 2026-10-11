import { describe, it, expect } from "vitest";
import { sum, clamp } from "../src/numbers.js";

describe("sum", () => {
  it("sums an array of numbers", () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
  it("returns 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });
  it("handles negative numbers", () => {
    expect(sum([-1, 1])).toBe(0);
  });
});

describe("clamp", () => {
  it("returns n when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps to min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps to max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("handles the min boundary exactly", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });
  it("handles the max boundary exactly", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
