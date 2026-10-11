import { isPlainObject } from "./internal/normalize.js";

export function merge(a: object, b: object): object {
  if (!isPlainObject(a) || !isPlainObject(b)) {
    throw new Error("merge() only accepts plain objects");
  }
  return { ...a, ...b };
}
