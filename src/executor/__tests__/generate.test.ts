import { describe, it, expect } from 'vitest';
import { GenerateExecutor } from '../generate.js';
import { buildExecutionContext } from '../../resolver/resolution-context.js';
import type { RuntimeContext } from '../../types/execution-context.js';

function emptyContext(): RuntimeContext {
  // GenerateExecutor uses no Playwright handles; cast is safe for unit tests.
  return buildExecutionContext({
    config: {},
    env: {},
    roleData: {},
    testVariables: {},
    dataImports: {},
  }) as unknown as RuntimeContext;
}

describe('GenerateExecutor', () => {
  const executor = new GenerateExecutor();

  it('generates a UUID and saves it to step outputs', async () => {
    const ctx = emptyContext();
    const result = await executor.execute(
      { generate: { myId: 'uuid' } },
      ctx,
    );
    const saved = result.resolution.stepOutputs['myId'];
    expect(typeof saved).toBe('string');
    // UUID v4 pattern
    expect(saved).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates a faker value for faker.internet.email', async () => {
    const ctx = emptyContext();
    const result = await executor.execute(
      { generate: { email: 'faker.internet.email' } },
      ctx,
    );
    const saved = result.resolution.stepOutputs['email'];
    expect(typeof saved).toBe('string');
    expect(saved as string).toContain('@');
  });

  it('generates multiple values in a single step', async () => {
    const ctx = emptyContext();
    const result = await executor.execute(
      { generate: { id: 'uuid', name: 'faker.person.firstName' } },
      ctx,
    );
    expect(result.resolution.stepOutputs['id']).toBeDefined();
    expect(result.resolution.stepOutputs['name']).toBeDefined();
  });

  it('throws for an unknown generator expression', async () => {
    const ctx = emptyContext();
    await expect(
      executor.execute({ generate: { x: 'magic.unknown.method' } }, ctx),
    ).rejects.toThrow(/Unknown generator expression/);
  });

  it('throws for a faker path that does not resolve to a function', async () => {
    const ctx = emptyContext();
    await expect(
      executor.execute({ generate: { x: 'faker.internet' } }, ctx),
    ).rejects.toThrow(/does not resolve to a function/);
  });
});
