import { describe, it, expect, vi } from 'vitest';
import { executeWithRetry, runSteps } from '../retry.js';
import { ExecutorRegistry } from '../../executor/registry.js';
import { buildMockCtx } from '../../test-helpers.js';
import type { AnyStep, StepExecutor } from '../../types/index.js';
import type { RuntimeContext } from '../../types/execution-context.js';

function makeStep(type = 'navigate', extra: Record<string, unknown> = {}): AnyStep {
  return { [type]: { url: '/home' }, ...extra } as unknown as AnyStep;
}

function makeRegistry(executor: StepExecutor): ExecutorRegistry {
  const r = new ExecutorRegistry();
  r.register(executor);
  return r;
}

// ─── executeWithRetry ─────────────────────────────────────────────────────────

describe('executeWithRetry', () => {
  it('returns the updated context on the first successful attempt', async () => {
    const ctx     = buildMockCtx();
    const updated = buildMockCtx();
    const executor: StepExecutor = {
      type:    'navigate',
      execute: vi.fn().mockResolvedValue(updated),
    };
    const registry = makeRegistry(executor);
    const step     = makeStep();

    const result = await executeWithRetry(step, ctx, registry, {
      maxAttempts: 1,
      delayMs:     0,
      stepIndex:   0,
      stepType:    'navigate',
    });

    expect(result).toBe(updated);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it('retries after failure and returns ctx when a later attempt succeeds', async () => {
    const ctx     = buildMockCtx();
    const updated = buildMockCtx();
    const executor: StepExecutor = {
      type: 'navigate',
      execute: vi.fn()
        .mockRejectedValueOnce(new Error('flake'))
        .mockResolvedValue(updated),
    };
    const registry = makeRegistry(executor);
    const step     = makeStep();

    const result = await executeWithRetry(step, ctx, registry, {
      maxAttempts: 2,
      delayMs:     0,
      stepIndex:   0,
      stepType:    'navigate',
    });

    expect(result).toBe(updated);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after exhausting all attempts', async () => {
    const ctx = buildMockCtx();
    const executor: StepExecutor = {
      type:    'navigate',
      execute: vi.fn().mockRejectedValue(new Error('persistent failure')),
    };
    const registry = makeRegistry(executor);
    const step     = makeStep();

    await expect(
      executeWithRetry(step, ctx, registry, {
        maxAttempts: 3,
        delayMs:     0,
        stepIndex:   0,
        stepType:    'navigate',
      }),
    ).rejects.toThrow('persistent failure');

    expect(executor.execute).toHaveBeenCalledTimes(3);
  });
});

// ─── runSteps ─────────────────────────────────────────────────────────────────

describe('runSteps', () => {
  it('returns the initial context when steps array is empty', async () => {
    const ctx      = buildMockCtx();
    const registry = new ExecutorRegistry();
    const result   = await runSteps([], ctx, registry, 0);
    expect(result).toBe(ctx);
  });

  it('accumulates context updates across multiple steps', async () => {
    const ctx0 = buildMockCtx();
    const ctx1 = buildMockCtx();
    const ctx2 = buildMockCtx();

    let call = 0;
    const executor: StepExecutor = {
      type: 'navigate',
      execute: vi.fn().mockImplementation((_step, _ctx: RuntimeContext) => {
        call++;
        return Promise.resolve(call === 1 ? ctx1 : ctx2);
      }),
    };
    const registry = makeRegistry(executor);

    const steps  = [makeStep(), makeStep()];
    const result = await runSteps(steps, ctx0, registry, 0);

    expect(result).toBe(ctx2);
    expect(executor.execute).toHaveBeenCalledTimes(2);
    // Second call receives the context returned by the first step
    expect(executor.execute).toHaveBeenNthCalledWith(2, steps[1], ctx1);
  });

  it('uses step-level retryDelay of 0 so the test does not wait', async () => {
    const ctx = buildMockCtx();
    const executor: StepExecutor = {
      type: 'navigate',
      execute: vi.fn()
        .mockRejectedValueOnce(new Error('flake'))
        .mockResolvedValue(ctx),
    };
    const registry = makeRegistry(executor);
    const step     = { navigate: { url: '/' }, retry: 1, retryDelay: 0 } as unknown as AnyStep;

    const result = await runSteps([step], ctx, registry, 0);
    expect(result).toBe(ctx);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });
});
