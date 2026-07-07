import { describe, it, expect, vi } from 'vitest';
import { AssertExecutor } from '../assert.js';
import { buildMockCtx, buildMockLocator, buildMockPage } from '../../test-helpers.js';
import type { AssertStep } from '../../types/index.js';

const executor = new AssertExecutor();

const selector = { type: 'role' as const, value: 'button' };

function makeStep(overrides: Partial<AssertStep['assert']> = {}): AssertStep {
  return { assert: { selector, ...overrides } };
}

function ctxWithLocator(locatorOverrides: Partial<ReturnType<typeof buildMockLocator>> = {}) {
  const locator = { ...buildMockLocator(), ...locatorOverrides };
  const page    = buildMockPage({ getByRole: vi.fn().mockReturnValue(locator) });
  return { ctx: buildMockCtx({ page }), locator };
}

describe('AssertExecutor — visible', () => {
  it('calls waitFor visible when visible:true and element is present', async () => {
    const { ctx, locator } = ctxWithLocator();
    await executor.execute(makeStep({ visible: true }), ctx);
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'visible' });
  });

  it('throws a descriptive error when visible:true but element is hidden', async () => {
    const { ctx } = ctxWithLocator({
      waitFor: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    await expect(executor.execute(makeStep({ visible: true }), ctx)).rejects.toThrow(
      'expected element (role="button") to be visible',
    );
  });

  it('calls waitFor hidden when visible:false', async () => {
    const { ctx, locator } = ctxWithLocator();
    await executor.execute(makeStep({ visible: false }), ctx);
    expect(locator.waitFor).toHaveBeenCalledWith({ state: 'hidden' });
  });

  it('throws a descriptive error when visible:false but element is visible', async () => {
    const { ctx } = ctxWithLocator({
      waitFor: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    await expect(executor.execute(makeStep({ visible: false }), ctx)).rejects.toThrow(
      'expected element (role="button") to be hidden',
    );
  });
});

describe('AssertExecutor — text', () => {
  it('passes when element text contains the expected substring', async () => {
    const { ctx } = ctxWithLocator({ textContent: vi.fn().mockResolvedValue('Hello World') });
    await expect(executor.execute(makeStep({ text: 'World' }), ctx)).resolves.not.toThrow();
  });

  it('throws when text is not found in the element', async () => {
    const { ctx } = ctxWithLocator({ textContent: vi.fn().mockResolvedValue('Goodbye') });
    await expect(executor.execute(makeStep({ text: 'World' }), ctx)).rejects.toThrow(
      'expected text "World" not found',
    );
  });
});

describe('AssertExecutor — value', () => {
  it('passes when input value matches', async () => {
    const { ctx } = ctxWithLocator({ inputValue: vi.fn().mockResolvedValue('alice@test.com') });
    await expect(
      executor.execute(makeStep({ value: 'alice@test.com' }), ctx),
    ).resolves.not.toThrow();
  });

  it('throws when input value does not match', async () => {
    const { ctx } = ctxWithLocator({ inputValue: vi.fn().mockResolvedValue('other') });
    await expect(
      executor.execute(makeStep({ value: 'alice@test.com' }), ctx),
    ).rejects.toThrow('expected input value "alice@test.com"');
  });
});

describe('AssertExecutor — count', () => {
  it('passes when element count matches', async () => {
    const { ctx } = ctxWithLocator({ count: vi.fn().mockResolvedValue(3) });
    await expect(executor.execute(makeStep({ count: 3 }), ctx)).resolves.not.toThrow();
  });

  it('throws when element count does not match', async () => {
    const { ctx } = ctxWithLocator({ count: vi.fn().mockResolvedValue(1) });
    await expect(executor.execute(makeStep({ count: 3 }), ctx)).rejects.toThrow(
      'expected count 3, got 1',
    );
  });
});

describe('AssertExecutor — enabled', () => {
  it('passes when enabled:true and element is enabled', async () => {
    const { ctx } = ctxWithLocator({ isEnabled: vi.fn().mockResolvedValue(true) });
    await expect(executor.execute(makeStep({ enabled: true }), ctx)).resolves.not.toThrow();
  });

  it('throws when enabled:true but element is disabled', async () => {
    const { ctx } = ctxWithLocator({ isEnabled: vi.fn().mockResolvedValue(false) });
    await expect(executor.execute(makeStep({ enabled: true }), ctx)).rejects.toThrow(
      'expected element (role="button") to be enabled',
    );
  });

  it('throws when enabled:false but element is enabled', async () => {
    const { ctx } = ctxWithLocator({ isEnabled: vi.fn().mockResolvedValue(true) });
    await expect(executor.execute(makeStep({ enabled: false }), ctx)).rejects.toThrow(
      'expected element (role="button") to be disabled',
    );
  });
});

describe('AssertExecutor — checked', () => {
  it('passes when checked:true and checkbox is checked', async () => {
    const { ctx } = ctxWithLocator({ isChecked: vi.fn().mockResolvedValue(true) });
    await expect(executor.execute(makeStep({ checked: true }), ctx)).resolves.not.toThrow();
  });

  it('throws when checked:true but checkbox is unchecked', async () => {
    const { ctx } = ctxWithLocator({ isChecked: vi.fn().mockResolvedValue(false) });
    await expect(executor.execute(makeStep({ checked: true }), ctx)).rejects.toThrow(
      'expected element (role="button") to be checked',
    );
  });

  it('throws when checked:false but checkbox is checked', async () => {
    const { ctx } = ctxWithLocator({ isChecked: vi.fn().mockResolvedValue(true) });
    await expect(executor.execute(makeStep({ checked: false }), ctx)).rejects.toThrow(
      'expected element (role="button") to be unchecked',
    );
  });
});

describe('AssertExecutor — context passthrough', () => {
  it('returns the same RuntimeContext unchanged', async () => {
    const ctx    = buildMockCtx();
    const result = await executor.execute(makeStep(), ctx);
    expect(result).toBe(ctx);
  });
});
