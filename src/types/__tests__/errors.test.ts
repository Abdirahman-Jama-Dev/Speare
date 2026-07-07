import { describe, it, expect } from 'vitest';
import { SpeareError, UserError, AppError, FrameworkError } from '../errors.js';

// ─── Hierarchy ────────────────────────────────────────────────────────────────

describe('SpeareError hierarchy', () => {
  it('UserError is a SpeareError and an Error', () => {
    const err = new UserError('bad yaml');
    expect(err).toBeInstanceOf(UserError);
    expect(err).toBeInstanceOf(SpeareError);
    expect(err).toBeInstanceOf(Error);
  });

  it('AppError is a SpeareError and an Error', () => {
    const err = new AppError('status 500');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(SpeareError);
    expect(err).toBeInstanceOf(Error);
  });

  it('FrameworkError is a SpeareError and an Error', () => {
    const err = new FrameworkError('null deref');
    expect(err).toBeInstanceOf(FrameworkError);
    expect(err).toBeInstanceOf(SpeareError);
    expect(err).toBeInstanceOf(Error);
  });

  it('UserError is NOT an AppError or FrameworkError', () => {
    const err = new UserError('bad yaml');
    expect(err).not.toBeInstanceOf(AppError);
    expect(err).not.toBeInstanceOf(FrameworkError);
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

describe('category field', () => {
  it('UserError has category "user"', () => {
    expect(new UserError('x').category).toBe('user');
  });

  it('AppError has category "app"', () => {
    expect(new AppError('x').category).toBe('app');
  });

  it('FrameworkError has category "framework"', () => {
    expect(new FrameworkError('x').category).toBe('framework');
  });
});

// ─── Names ────────────────────────────────────────────────────────────────────

describe('error names', () => {
  it('UserError.name is "UserError"', () => {
    expect(new UserError('x').name).toBe('UserError');
  });

  it('AppError.name is "AppError"', () => {
    expect(new AppError('x').name).toBe('AppError');
  });

  it('FrameworkError.name is "FrameworkError"', () => {
    expect(new FrameworkError('x').name).toBe('FrameworkError');
  });
});

// ─── Messages ─────────────────────────────────────────────────────────────────

describe('message propagation', () => {
  it('preserves the message string', () => {
    const msg = 'Page object "LoginPage" not found';
    expect(new UserError(msg).message).toBe(msg);
  });
});
