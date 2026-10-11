export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

export function validateTask(
  input: { title?: unknown; completed?: unknown },
  opts: { partial: boolean }
): ValidateResult {
  const errors: string[] = [];

  const titleProvided = input.title !== undefined;

  if (!titleProvided) {
    if (!opts.partial) {
      errors.push("title is required");
    }
  } else {
    if (typeof input.title !== "string") {
      errors.push("title must be a string");
    } else {
      const trimmed = input.title.trim();
      if (trimmed.length === 0) {
        errors.push("title must not be empty");
      }
      if (input.title.length > 100) {
        errors.push("title must be at most 100 characters");
      }
    }
  }

  if (input.completed !== undefined && typeof input.completed !== "boolean") {
    errors.push("completed must be a boolean");
  }

  return { valid: errors.length === 0, errors };
}
