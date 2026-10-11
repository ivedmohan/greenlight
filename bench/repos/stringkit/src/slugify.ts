import { normalizeForSlug } from "./internal/normalize.js";

export function slugify(s: string): string {
  return normalizeForSlug(s);
}
