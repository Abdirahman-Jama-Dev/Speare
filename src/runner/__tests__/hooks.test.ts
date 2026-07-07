import { describe, it, expect, vi } from 'vitest';
import { runHook } from '../hooks.js';
import { ExecutorRegistry } from '../../executor/registry.js';
import { buildMockCtx } from '../../test-helpers.js';
import type { Hooks, StepExecutor } from '../../types/index.js';

function makeRegistry(updated = buildMockCtx()): ExecutorRegistry {
  const executor: StepExecutor = {
    type:    'api',
    execute: vi.fn().mockResolvedValue(updated),
  };
  const r = new ExecutorRegistry();
  r.register(executor);
  return r;
}

const apiStep = { api: { method: 'GET' as const, url: '/ping' } };

describe('runHook', () => {
  it('returns the same context when hooks is undefined', async () => {
    const ctx    = buildMockCtx();
    const result = await runHook('beforeAll', undefined, ctx, new ExecutorRegistry());
    expect(result).toBe(ctx);
  });

  it('returns the same context when the named hook has no steps', async () => {
    const ctx    = buildMockCtx();
    const hooks: Hooks = { beforeAll: [] };
    const result = await runHook('beforeAll', hooks, ctx, new ExecutorRegistry());
    expect(result).toBe(ctx);
  });

  it('returns the same context when the named hook is not present', async () => {
    const ctx    = buildMockCtx();
    const hooks: Hooks = { afterAll: [apiStep] };
    const result = await runHook('beforeAll', hooks, ctx, makeRegistry());
    expect(result).toBe(ctx);
  });

  it('runs hook steps and returns the updated context', async () => {
    const ctx     = buildMockCtx();
    const updated = buildMockCtx();
    const registry = makeRegistry(updated);
    const hooks: Hooks = { beforeAll: [apiStep] };

    const result = await runHook('beforeAll', hooks, ctx, registry);
    expect(result).toBe(updated);
  });

  it('runs afterEach hooks and propagates their context', async () => {
    const ctx     = buildMockCtx();
    const updated = buildMockCtx();
    const registry = makeRegistry(updated);
    const hooks: Hooks = { afterEach: [apiStep] };

    const result = await runHook('afterEach', hooks, ctx, registry);
    expect(result).toBe(updated);
  });
});

