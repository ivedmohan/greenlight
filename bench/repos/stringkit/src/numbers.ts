export function sum(nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
