import { isPlainObject } from "./internal/normalize.js";

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => Object.prototype.hasOwnProperty.call(bObj, k) && deepEqual(aObj[k], bObj[k]));
  }

  return false;
}
