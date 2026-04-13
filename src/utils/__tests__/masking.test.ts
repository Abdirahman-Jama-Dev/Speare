import { describe, it, expect } from 'vitest';
import { mask, maskDeep } from '../masking.js';
import { createMaskedValue, isMaskedValue, maskDisplay } from '../../types/masked-value.js';

describe('MaskedValue', () => {
  it('createMaskedValue marks a value as masked', () => {
    const mv = createMaskedValue('super_secret');
    expect(isMaskedValue(mv)).toBe(true);
    expect(mv.value).toBe('super_secret');
  });

  it('maskDisplay returns block characters, not the real value', () => {
    const mv = createMaskedValue('super_secret');
    const display = maskDisplay(mv);
    expect(display).not.toContain('super_secret');
    expect(display).toBe('████████');
  });
});

describe('mask()', () => {
  it('returns masked display for a MaskedValue', () => {
    const mv = createMaskedValue('hunter2');
    expect(mask(mv)).toBe('████████');
  });

  it('passes through plain strings unchanged', () => {
    expect(mask('hello')).toBe('hello');
  });

  it('passes through numbers unchanged', () => {
    expect(mask(42)).toBe(42);
  });
});

describe('maskDeep()', () => {
  it('replaces MaskedValue inside a nested object', () => {
    const obj = {
      username: 'alice',
      password: createMaskedValue('p@ssw0rd'),
      nested: { token: createMaskedValue('tok_abc') },
    };
    const result = maskDeep(obj) as typeof obj;
    expect((result as Record<string, unknown>)['username']).toBe('alice');
    expect((result as Record<string, unknown>)['password']).toBe('████████');
    expect((result.nested as Record<string, unknown>)['token']).toBe('████████');
  });

  it('handles arrays', () => {
    const arr = [createMaskedValue('secret'), 'plain'];
    const result = maskDeep(arr) as string[];
    expect(result[0]).toBe('████████');
    expect(result[1]).toBe('plain');
  });
});
