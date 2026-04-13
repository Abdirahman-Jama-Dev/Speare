import type { AnyStep, RuntimeContext } from '../types/index.js';
import type { ExecutorRegistry } from '../executor/registry.js';
import { logger } from '../utils/logger.js';

// ─── Retry ────────────────────────────────────────────────────────────────────

const DEFAULT_RETRY_DELAY_MS = 1000;

interface RetryOptions {
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly stepIndex: number;
  readonly stepType: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a step with retry logic.
 * Retries on any thrown error, up to maxAttempts total.
 * The registry's execute() returns ExecutionContext but all callers pass
 * RuntimeContext instances, so the cast here is safe.
 */
export async function executeWithRetry(
  step: AnyStep,
  context: RuntimeContext,
  registry: ExecutorRegistry,
  options: RetryOptions,
): Promise<RuntimeContext> {
  const { maxAttempts, delayMs, stepIndex, stepType } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return (await registry.execute(step, context)) as RuntimeContext;
    } catch (err) {
      lastError = err;

      if (attempt < maxAttempts) {
        logger.warn(`Step ${stepIndex} (${stepType}) failed. Retrying (${attempt}/${maxAttempts - 1})...`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

// ─── Step Runner ──────────────────────────────────────────────────────────────

/**
 * Run all steps in a test, accumulating context updates (save: outputs).
 * stepOffset is used for accurate step indexing when called from hooks.
 */
export async function runSteps(
  steps: readonly AnyStep[],
  initialContext: RuntimeContext,
  registry: ExecutorRegistry,
  stepOffset = 0,
): Promise<RuntimeContext> {
  let context = initialContext;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;

    const type = registry.detectType(step);
    const stepIndex = i + stepOffset;

    const retryCount = (step as { retry?: number }).retry ?? 0;
    const retryDelay = (step as { retryDelay?: number }).retryDelay ?? DEFAULT_RETRY_DELAY_MS;

    context = await executeWithRetry(step, context, registry, {
      maxAttempts: retryCount + 1,
      delayMs: retryDelay,
      stepIndex,
      stepType: type,
    });
  }

  return context;
}
