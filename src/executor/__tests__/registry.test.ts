import { describe, it, expect, vi } from 'vitest';
import { ExecutorRegistry } from '../registry.js';
import { buildMockCtx } from '../../test-helpers.js';
import type { AnyStep, StepExecutor, RuntimeContext } from '../../types/index.js';

function makeExecutor(type: string, returnCtx?: RuntimeContext): StepExecutor {
  return {
    type,
    execute: vi.fn().mockImplementation((_step, ctx) => Promise.resolve(returnCtx ?? ctx)),
  };
}

describe('ExecutorRegistry', () => {
  it('registers an executor and detects its type', () => {
    const registry = new ExecutorRegistry();
    registry.register(makeExecutor('navigate'));
    const step = { navigate: { url: '/home' } } as AnyStep;
    expect(registry.detectType(step)).toBe('navigate');
  });

  it('throws when registering a duplicate type', () => {
    const registry = new ExecutorRegistry();
    registry.register(makeExecutor('navigate'));
    expect(() => registry.register(makeExecutor('navigate'))).toThrow(
      'Executor already registered for step type: "navigate"',
    );
  });

  it('throws detectType for an unrecognised step', () => {
    const registry = new ExecutorRegistry();
    registry.register(makeExecutor('navigate'));
    const unknown = { unknown: {} } as unknown as AnyStep;
    expect(() => registry.detectType(unknown)).toThrow('Unknown step type');
  });

  it('dispatches execute to the correct executor', async () => {
    const registry = new ExecutorRegistry();
    const ctx      = buildMockCtx();
    const updated  = buildMockCtx();
    const executor = makeExecutor('navigate', updated);
    registry.register(executor);

    const step   = { navigate: { url: '/home' } } as AnyStep;
    const result = await registry.execute(step, ctx);

    expect(executor.execute).toHaveBeenCalledWith(step, ctx);
    expect(result).toBe(updated);
  });

  it('throws execute when no matching executor found', async () => {
    const registry = new ExecutorRegistry();
    const ctx  = buildMockCtx();
    const step = { navigate: { url: '/home' } } as AnyStep;
    await expect(registry.execute(step, ctx)).rejects.toThrow('Unknown step type');
  });
});
