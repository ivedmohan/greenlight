export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number
): Promise<T> {
  let lastError: unknown;
  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attemptIndex < attempts - 1) {
        const delay = baseDelayMs * 2 ** attemptIndex;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
