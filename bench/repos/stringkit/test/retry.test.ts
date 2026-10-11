import { describe, it, expect } from "vitest";
import { retryWithBackoff } from "../src/retry.js";

describe("retryWithBackoff", () => {
  it("resolves once the function eventually succeeds", async () => {
    let calls = 0;
    const result = await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("not yet");
        return "ok";
      },
      5,
      10
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("rejects with the last error after exhausting attempts", async () => {
    await expect(
      retryWithBackoff(
        async () => {
          throw new Error("always fails");
        },
        3,
        10
      )
    ).rejects.toThrow("always fails");
  });

  it("completes quickly for small base delays (no runaway backoff)", async () => {
    const start = Date.now();
    let calls = 0;
    await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("not yet");
        return "done";
      },
      5,
      10
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });
});
