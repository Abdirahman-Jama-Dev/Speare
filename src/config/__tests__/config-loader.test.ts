import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { loadEnvFile, loadFrameworkConfig } from '../index.js';

// ─── .env loader ─────────────────────────────────────────────────────────────

describe('loadEnvFile()', () => {
  function withEnvFile(content: string, fn: (dir: string) => void): void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speare-test-'));
    try {
      fs.writeFileSync(path.join(dir, '.env'), content, 'utf-8');
      fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  }

  it('returns empty object when .env does not exist', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speare-test-'));
    try {
      expect(loadEnvFile(dir)).toEqual({});
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('parses KEY=VALUE pairs', () => {
    withEnvFile('FOO=bar\nBAZ=qux\n', (dir) => {
      expect(loadEnvFile(dir)).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });
  });

  it('strips surrounding quotes from values', () => {
    withEnvFile('TOKEN="my_token"\nSECRET=\'shh\'\n', (dir) => {
      expect(loadEnvFile(dir)).toEqual({ TOKEN: 'my_token', SECRET: 'shh' });
    });
  });

  it('ignores comment lines', () => {
    withEnvFile('# This is a comment\nACTUAL=yes\n', (dir) => {
      expect(loadEnvFile(dir)).toEqual({ ACTUAL: 'yes' });
    });
  });

  it('ignores blank lines', () => {
    withEnvFile('\n\nA=1\n\nB=2\n', (dir) => {
      expect(loadEnvFile(dir)).toEqual({ A: '1', B: '2' });
    });
  });
});

// ─── framework config loader ─────────────────────────────────────────────────

describe('loadFrameworkConfig()', () => {
  it('returns an empty object when config file is absent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speare-test-'));
    try {
      expect(loadFrameworkConfig(dir)).toEqual({});
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('parses and validates a valid config file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'speare-test-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'framework.config.yaml'),
        'retries: 2\nparallel:\n  workers: 4\n',
        'utf-8',
      );
      const config = loadFrameworkConfig(dir);
      expect(config.retries).toBe(2);
      expect(config.parallel?.workers).toBe(4);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});
