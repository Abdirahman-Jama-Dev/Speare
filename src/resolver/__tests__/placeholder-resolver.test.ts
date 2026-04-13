import { describe, it, expect } from 'vitest';
import {
  interpolateString,
  resolveDeep,
  UnresolvedPlaceholderError,
} from '../placeholder-resolver.js';
import type { ResolutionLayers } from '../placeholder-resolver.js';
import { createMaskedValue } from '../../types/masked-value.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function layers(
  overrides: Partial<ResolutionLayers> = {},
): ResolutionLayers {
  return {
    env: {},
    testData: {},
    stepOutputs: {},
    ...overrides,
  };
}

const STEP_IDX = 0;
const STEP_TYPE = 'test';

// ─── ENV.* Resolution ─────────────────────────────────────────────────────────

describe('interpolateString — ENV.* references', () => {
  it('resolves a standalone ENV.KEY to a MaskedValue', () => {
    const l = layers({ env: { MY_SECRET: 'abc123' } });
    const result = interpolateString('ENV.MY_SECRET', l, STEP_IDX, STEP_TYPE);
    expect(result).toMatchObject({ __masked: true, value: 'abc123' });
  });

  it('resolves an inline ENV.KEY within a URL string (returns string)', () => {
    const l = layers({ env: { BASE_URL: 'https://example.com' } });
    const result = interpolateString('ENV.BASE_URL/api/users', l, STEP_IDX, STEP_TYPE);
    expect(result).toBe('https://example.com/api/users');
  });

  it('throws UnresolvedPlaceholderError for missing ENV key', () => {
    expect(() =>
      interpolateString('ENV.MISSING_KEY', layers(), STEP_IDX, STEP_TYPE),
    ).toThrow(UnresolvedPlaceholderError);
  });
});

// ─── {key} Brace Syntax ───────────────────────────────────────────────────────

describe('interpolateString — {key} brace syntax', () => {
  it('resolves a standalone {key} from stepOutputs (layer 1)', () => {
    const l = layers({ stepOutputs: { orderId: 'ord_99' } });
    expect(interpolateString('{orderId}', l, STEP_IDX, STEP_TYPE)).toBe('ord_99');
  });

  it('resolves a standalone {key} from testData (layer 2)', () => {
    const l = layers({ testData: { username: 'alice' } });
    expect(interpolateString('{username}', l, STEP_IDX, STEP_TYPE)).toBe('alice');
  });

  it('interpolates {key} embedded in a larger string', () => {
    const l = layers({ stepOutputs: { userId: 'u_42' } });
    expect(
      interpolateString('/api/users/{userId}/profile', l, STEP_IDX, STEP_TYPE),
    ).toBe('/api/users/u_42/profile');
  });

  it('throws for an unresolved {key}', () => {
    expect(() =>
      interpolateString('{ghost}', layers(), STEP_IDX, STEP_TYPE),
    ).toThrow(UnresolvedPlaceholderError);
  });
});

// ─── Layer Precedence ─────────────────────────────────────────────────────────

describe('interpolateString — layer precedence', () => {
  it('stepOutputs (layer 1) overrides testData (layer 2)', () => {
    const l = layers({
      stepOutputs: { name: 'from_step' },
      testData: { name: 'from_data' },
    });
    expect(interpolateString('name', l, STEP_IDX, STEP_TYPE)).toBe('from_step');
  });

  it('testData (layer 2) overrides env (layer 3)', () => {
    const l = layers({
      testData: { HOST: 'from_data' },
      env: { HOST: 'from_env' },
    });
    expect(interpolateString('HOST', l, STEP_IDX, STEP_TYPE)).toBe('from_data');
  });
});

// ─── Bare Exact Match ─────────────────────────────────────────────────────────

describe('interpolateString — bare exact match', () => {
  it('resolves a bare key from testData', () => {
    const l = layers({ testData: { password: 'secret' } });
    expect(interpolateString('password', l, STEP_IDX, STEP_TYPE)).toBe('secret');
  });

  it('returns literal string when key is not in any layer', () => {
    const l = layers();
    // A literal string that doesn't match any key should pass through
    expect(interpolateString('Hello World', l, STEP_IDX, STEP_TYPE)).toBe('Hello World');
  });
});

// ─── resolveDeep ─────────────────────────────────────────────────────────────

describe('resolveDeep', () => {
  it('recursively resolves strings in a nested object', () => {
    const l = layers({ testData: { user: 'bob' }, env: { HOST: 'localhost' } });
    const input = {
      url: 'ENV.HOST/profile',
      body: { name: 'user' },
    };
    const result = resolveDeep(input, l, STEP_IDX, STEP_TYPE) as typeof input;
    expect(result.url).toBe('localhost/profile');
    expect(result.body.name).toBe('bob');
  });

  it('resolves strings inside arrays', () => {
    const l = layers({ testData: { item: 'apple' } });
    const result = resolveDeep(['item', 'banana'], l, STEP_IDX, STEP_TYPE) as string[];
    expect(result[0]).toBe('apple');
    expect(result[1]).toBe('banana');
  });

  it('passes non-string primitives through unchanged', () => {
    const l = layers();
    expect(resolveDeep(42, l, STEP_IDX, STEP_TYPE)).toBe(42);
    expect(resolveDeep(true, l, STEP_IDX, STEP_TYPE)).toBe(true);
    expect(resolveDeep(null, l, STEP_IDX, STEP_TYPE)).toBe(null);
  });
});

// ─── Error Messages ───────────────────────────────────────────────────────────

describe('UnresolvedPlaceholderError messages', () => {
  it('includes the placeholder name, step index, and step type', () => {
    const l = layers({ env: { OTHER: 'x' }, testData: { known: '1' } });
    let error: UnresolvedPlaceholderError | null = null;
    try {
      interpolateString('{missingKey}', l, 3, 'api');
    } catch (e) {
      error = e as UnresolvedPlaceholderError;
    }
    expect(error).not.toBeNull();
    expect(error?.message).toContain('"missingKey"');
    expect(error?.message).toContain('step 3');
    expect(error?.message).toContain('api');
  });

  it('includes "did you mean" suggestions for close matches', () => {
    const l = layers({ testData: { userId: '42' } });
    let error: UnresolvedPlaceholderError | null = null;
    try {
      interpolateString('{userID}', l, 0, 'assert');
    } catch (e) {
      error = e as UnresolvedPlaceholderError;
    }
    expect(error?.message).toContain('Did you mean');
    expect(error?.message).toContain('userId');
  });
});
