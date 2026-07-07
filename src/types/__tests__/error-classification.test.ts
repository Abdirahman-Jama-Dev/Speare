/**
 * Verifies that each throw site in the framework produces the correct
 * SpeareError category. This is the contract that the SaaS layer depends on
 * to triage failures without parsing error message strings.
 */
import { describe, it, expect, vi } from 'vitest';
import { UserError, AppError, FrameworkError, SpeareError } from '../errors.js';
import { YamlValidationError } from '../../schema/index.js';
import { UnresolvedPlaceholderError } from '../../resolver/placeholder-resolver.js';
import { UiExecutor } from '../../executor/ui.js';
import { ApiExecutor } from '../../executor/api.js';
import { AssertExecutor } from '../../executor/assert.js';
import { DbExecutor } from '../../executor/db.js';
import { ExecutorRegistry } from '../../executor/registry.js';
import { buildLocatorFromDefinition } from '../../executor/locator-builder.js';
import {
  buildMockCtx,
  buildMockPage,
  buildMockLocator,
  buildMockApiContext,
  buildMockResponse,
  buildLoginPageObject,
} from '../../test-helpers.js';
import type { AnyStep } from '../index.js';

// ─── Schema / Loader errors → UserError ──────────────────────────────────────

describe('YamlValidationError', () => {
  it('is a UserError', () => {
    const err = new YamlValidationError('file.yaml', 'page-object', [
      { path: '/name', message: 'must be string' },
    ]);
    expect(err).toBeInstanceOf(UserError);
    expect(err).toBeInstanceOf(SpeareError);
    expect(err.category).toBe('user');
    expect(err.name).toBe('YamlValidationError');
  });
});

// ─── Resolver errors → UserError ─────────────────────────────────────────────

describe('UnresolvedPlaceholderError', () => {
  it('is a UserError', () => {
    const err = new UnresolvedPlaceholderError('Unresolved placeholder "userId"');
    expect(err).toBeInstanceOf(UserError);
    expect(err).toBeInstanceOf(SpeareError);
    expect(err.category).toBe('user');
    expect(err.name).toBe('UnresolvedPlaceholderError');
  });
});

// ─── UiExecutor errors → UserError ───────────────────────────────────────────

describe('UiExecutor', () => {
  const exec = new UiExecutor();

  it('throws UserError for unknown page object', async () => {
    const ctx = buildMockCtx();
    await expect(
      exec.execute({ ui: { pageObject: 'Ghost', action: 'click' } }, ctx),
    ).rejects.toThrow(UserError);
  });

  it('throws UserError for unknown action', async () => {
    const pageObjects = new Map([['LoginPage', buildLoginPageObject()]]);
    const ctx = buildMockCtx({ pageObjects });
    await expect(
      exec.execute({ ui: { pageObject: 'LoginPage', action: 'doesNotExist' } }, ctx),
    ).rejects.toThrow(UserError);
  });

  it('throws UserError for unknown selector in action', async () => {
    const brokenPage = {
      ...buildLoginPageObject(),
      actions: { go: [{ action: 'click' as const, selector: 'missingBtn' }] },
    };
    const page = buildMockPage({ url: vi.fn().mockReturnValue('https://app.test/login') });
    const pageObjects = new Map([['LoginPage', brokenPage]]);
    const ctx = buildMockCtx({ pageObjects, page, config: { baseUrl: 'https://app.test' } });
    await expect(
      exec.execute({ ui: { pageObject: 'LoginPage', action: 'go' } }, ctx),
    ).rejects.toThrow(UserError);
  });
});

// ─── ApiExecutor errors → AppError ───────────────────────────────────────────

describe('ApiExecutor', () => {
  const exec = new ApiExecutor();

  it('throws AppError for status mismatch', async () => {
    const ctx = buildMockCtx({ apiContext: buildMockApiContext(buildMockResponse(500)) });
    await expect(
      exec.execute({ api: { method: 'GET', url: '/ping', assert: { status: 200 } } }, ctx),
    ).rejects.toThrow(AppError);
  });

  it('throws AppError for jsonPath equals mismatch', async () => {
    const ctx = buildMockCtx({ apiContext: buildMockApiContext(buildMockResponse(200, { id: 99 })) });
    await expect(
      exec.execute({ api: { method: 'GET', url: '/u', assert: { jsonPath: '$.id', equals: 1 } } }, ctx),
    ).rejects.toThrow(AppError);
  });

  it('throws AppError for greaterThan mismatch', async () => {
    const ctx = buildMockCtx({ apiContext: buildMockApiContext(buildMockResponse(200, { n: 1 })) });
    await expect(
      exec.execute({ api: { method: 'GET', url: '/u', assert: { jsonPath: '$.n', greaterThan: 10 } } }, ctx),
    ).rejects.toThrow(AppError);
  });

  it('throws AppError for lessThan mismatch', async () => {
    const ctx = buildMockCtx({ apiContext: buildMockApiContext(buildMockResponse(200, { n: 999 })) });
    await expect(
      exec.execute({ api: { method: 'GET', url: '/u', assert: { jsonPath: '$.n', lessThan: 10 } } }, ctx),
    ).rejects.toThrow(AppError);
  });
});

// ─── AssertExecutor errors → AppError ────────────────────────────────────────

describe('AssertExecutor', () => {
  const exec = new AssertExecutor();
  const selector = { type: 'role' as const, value: 'button' };

  function ctxFailing(locatorOverrides: Partial<ReturnType<typeof buildMockLocator>> = {}) {
    const locator = { ...buildMockLocator(), ...locatorOverrides };
    const page = buildMockPage({ getByRole: vi.fn().mockReturnValue(locator) });
    return buildMockCtx({ page });
  }

  it('throws AppError when visible:true fails', async () => {
    const ctx = ctxFailing({ waitFor: vi.fn().mockRejectedValue(new Error('timeout')) });
    await expect(
      exec.execute({ assert: { selector, visible: true } }, ctx),
    ).rejects.toThrow(AppError);
  });

  it('throws AppError when text assertion fails', async () => {
    const ctx = ctxFailing({ textContent: vi.fn().mockResolvedValue('wrong') });
    await expect(
      exec.execute({ assert: { selector, text: 'expected' } }, ctx),
    ).rejects.toThrow(AppError);
  });

  it('throws AppError when count assertion fails', async () => {
    const ctx = ctxFailing({ count: vi.fn().mockResolvedValue(0) });
    await expect(
      exec.execute({ assert: { selector, count: 5 } }, ctx),
    ).rejects.toThrow(AppError);
  });
});

// ─── DbExecutor errors → UserError / AppError ────────────────────────────────

describe('DbExecutor', () => {
  const exec = new DbExecutor();

  it('throws UserError when no database connection is configured', async () => {
    const ctx = buildMockCtx({ dbConnection: null });
    await expect(
      exec.execute({ db: { query: 'SELECT 1' } }, ctx),
    ).rejects.toThrow(UserError);
  });

  it('throws AppError when row count assertion fails', async () => {
    const mockDb = { query: vi.fn().mockResolvedValue([]), teardown: vi.fn() };
    const ctx = buildMockCtx({ dbConnection: mockDb });
    await expect(
      exec.execute({ db: { query: 'SELECT 1', assert: { rowCount: 1 } } }, ctx),
    ).rejects.toThrow(AppError);
  });
});

// ─── ExecutorRegistry errors ──────────────────────────────────────────────────

describe('ExecutorRegistry', () => {
  it('throws UserError for an unrecognised step type', async () => {
    const registry = new ExecutorRegistry();
    const step = { unknownStep: {} } as unknown as AnyStep;
    await expect(registry.execute(step, buildMockCtx())).rejects.toThrow(UserError);
  });

  it('throws FrameworkError for duplicate executor registration', () => {
    const registry = new ExecutorRegistry();
    const exec = { type: 'navigate', execute: vi.fn() };
    registry.register(exec);
    expect(() => registry.register(exec)).toThrow(FrameworkError);
  });
});

// ─── locator-builder → FrameworkError ────────────────────────────────────────

describe('buildLocatorFromDefinition', () => {
  it('throws FrameworkError for an unsupported selector type', () => {
    const page = buildMockPage();
    expect(() =>
      buildLocatorFromDefinition(page, {
        type: 'invalid' as never,
        value: 'x',
      }),
    ).toThrow(FrameworkError);
  });
});
