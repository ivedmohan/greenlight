export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function flattenDeep(arr: any[]): any[] {
  const out: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      out.push(...flattenDeep(item));
    } else {
      out.push(item);
    }
  }
  return out;
}
