import { describe, it, expect } from 'vitest';
import { validate, YamlValidationError } from '../index.js';

// ─── framework-config schema ─────────────────────────────────────────────────

describe('schema validation — framework-config', () => {
  it('accepts a valid minimal config (empty object)', () => {
    expect(() => validate('test.yaml', 'framework-config', {})).not.toThrow();
  });

  it('accepts a full valid config', () => {
    const config = {
      baseUrl: 'http://localhost:3000',
      retries: 2,
      parallel: { workers: 4 },
      database: {
        driver: 'postgres',
        connectionString: 'ENV.DB_URL',
        ssl: true,
        isolationMode: 'readonly',
      },
      security: { allowEval: false },
      reporters: ['json', 'junit'],
    };
    expect(() => validate('test.yaml', 'framework-config', config)).not.toThrow();
  });

  it('rejects an unknown top-level key', () => {
    expect(() =>
      validate('test.yaml', 'framework-config', { unknownField: true }),
    ).toThrow(YamlValidationError);
  });

  it('rejects an invalid db driver', () => {
    expect(() =>
      validate('test.yaml', 'framework-config', { database: { driver: 'oracle', connectionString: 'x' } }),
    ).toThrow(YamlValidationError);
  });
});

// ─── page-object schema ───────────────────────────────────────────────────────

describe('schema validation — page-object', () => {
  it('accepts a valid page object', () => {
    const po = {
      name: 'LoginPage',
      selectors: {
        emailField: { type: 'placeholder', value: 'email' },
        submitBtn: { type: 'role', value: 'button', options: { name: 'Sign in' } },
      },
      actions: {
        login: [
          { action: 'fill', selector: 'emailField', value: 'username' },
          { action: 'click', selector: 'submitBtn' },
        ],
      },
    };
    expect(() => validate('pages/login.yaml', 'page-object', po)).not.toThrow();
  });

  it('rejects a forbidden selector type (css)', () => {
    const po = {
      name: 'Bad',
      selectors: { evil: { type: 'css', value: '.foo' } },
      actions: {},
    };
    expect(() => validate('pages/bad.yaml', 'page-object', po)).toThrow(YamlValidationError);
  });

  it('rejects a forbidden selector type (xpath)', () => {
    const po = {
      name: 'Bad',
      selectors: { evil: { type: 'xpath', value: '//div' } },
      actions: {},
    };
    expect(() => validate('pages/bad.yaml', 'page-object', po)).toThrow(YamlValidationError);
  });
});

// ─── test-definition schema ───────────────────────────────────────────────────

describe('schema validation — test-definition', () => {
  it('accepts a minimal valid test', () => {
    const test = {
      name: 'My test',
      steps: [{ api: { method: 'GET', url: 'http://example.com' } }],
    };
    expect(() => validate('tests/my.yaml', 'test-definition', test)).not.toThrow();
  });

  it('rejects a test with no steps', () => {
    expect(() =>
      validate('tests/empty.yaml', 'test-definition', { name: 'Empty', steps: [] }),
    ).toThrow(YamlValidationError);
  });

  it('rejects a test with an unknown step type', () => {
    const test = {
      name: 'Bad step',
      steps: [{ browserAction: { do: 'something' } }],
    };
    expect(() => validate('tests/bad.yaml', 'test-definition', test)).toThrow(YamlValidationError);
  });

  it('rejects an API step with an invalid HTTP method', () => {
    const test = {
      name: 'Bad method',
      steps: [{ api: { method: 'CONNECT', url: 'http://example.com' } }],
    };
    expect(() => validate('tests/bad.yaml', 'test-definition', test)).toThrow(YamlValidationError);
  });
});

// ─── YamlValidationError ─────────────────────────────────────────────────────

describe('YamlValidationError', () => {
  it('includes the file path and schema name in the message', () => {
    let err: YamlValidationError | null = null;
    try {
      validate('tests/bad.yaml', 'test-definition', { name: 'X', steps: [] });
    } catch (e) {
      err = e as YamlValidationError;
    }
    expect(err).not.toBeNull();
    expect(err?.filePath).toBe('tests/bad.yaml');
    expect(err?.schemaName).toBe('test-definition');
    expect(err?.message).toContain('tests/bad.yaml');
  });
});
