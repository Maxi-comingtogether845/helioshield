/**
 * GlobalSim Helioshield — Retry with Exponential Backoff
 *
 * Wraps any async function with configurable retry logic.
 * Adds jitter to prevent thundering herd.
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  /** Jitter factor 0–1. Default 0.3 */
  jitter?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: 0.3,
};

export class RetryError extends Error {
  readonly attempts: number;
  readonly lastError: unknown;

  constructor(message: string, attempts: number, lastError: unknown) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {}
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts) break;

      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1),
        options.maxDelayMs
      );
      const jitteredDelay = delay * (1 + options.jitter * (Math.random() - 0.5));
      await sleep(jitteredDelay);
    }
  }

  throw new RetryError(
    `All ${options.maxAttempts} attempts failed`,
    options.maxAttempts,
    lastError
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
