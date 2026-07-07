import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Suite, TestCase, TestResult, FullResult, FullConfig } from '@playwright/test/reporter';
import SpeareReporter from '../speare-reporter.js';

// ─── Minimal Playwright type stubs ────────────────────────────────────────────

function makeTestResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    retry: 0,
    status: 'passed',
    duration: 100,
    errors: [],
    error: undefined,
    attachments: [],
    stdout: [],
    stderr: [],
    steps: [],
    startTime: new Date(),
    parallelIndex: 0,
    workerIndex: 0,
    annotations: [],
    ...overrides,
  } as TestResult;
}

function makeTest(title: string, result: Partial<TestResult>): TestCase {
  return {
    title,
    results: [makeTestResult(result)],
  } as unknown as TestCase;
}

function makeProjectSuite(name: string, tests: TestCase[]): Suite {
  return {
    title: name,
    allTests: () => tests,
    suites: [],
  } as unknown as Suite;
}

function makeRootSuite(projectSuites: Suite[]): Suite {
  return {
    title: '',
    suites: projectSuites,
    allTests: () => projectSuites.flatMap(s => s.allTests()),
  } as unknown as Suite;
}

function makeFullResult(status: FullResult['status'] = 'passed'): FullResult {
  return { status, startTime: new Date('2026-01-01T00:00:00Z'), duration: 5000 };
}

// ─── Test setup ───────────────────────────────────────────────────────────────

let tmpDir: string;
let outputFile: string;

beforeEach(() => {
  tmpDir     = fs.mkdtempSync(path.join(os.tmpdir(), 'speare-reporter-'));
  outputFile = path.join(tmpDir, 'results.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runReporter(projectSuites: Suite[], fullResult: FullResult = makeFullResult()): unknown {
  const reporter = new SpeareReporter({ outputFile });
  reporter.onBegin?.({} as FullConfig, makeRootSuite(projectSuites));
  reporter.onEnd?.(fullResult);
  return JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpeareReporter', () => {
  it('writes a passing result when all tests pass', () => {
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Login flow', { status: 'passed', duration: 200 }),
        makeTest('Health check', { status: 'passed', duration: 150 }),
      ]),
    ]) as Record<string, unknown>;

    expect(result.status).toBe('passed');
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(2);
  });

  it('writes a failed result when any test fails', () => {
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Login flow', { status: 'passed' }),
        makeTest('Checkout', { status: 'failed' }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    expect(result.status).toBe('failed');
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.total).toBe(2);
  });

  it('extracts category:user from a UserError stack', () => {
    const stack = 'UserError: missing env var\n  at foo.ts:10:5';
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Test', { status: 'failed', errors: [{ message: 'missing env var', stack }] }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ error: { category: string } }> }>;
    expect(suites[0].tests[0].error.category).toBe('user');
  });

  it('extracts category:app from an AppError stack', () => {
    const stack = 'AppError: assertion failed\n  at assert.ts:5:3';
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Test', { status: 'failed', errors: [{ message: 'assertion failed', stack }] }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ error: { category: string } }> }>;
    expect(suites[0].tests[0].error.category).toBe('app');
  });

  it('extracts category:framework from a FrameworkError stack', () => {
    const stack = 'FrameworkError: unexpected state\n  at runner.ts:99:1';
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Test', { status: 'failed', errors: [{ message: 'unexpected state', stack }] }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ error: { category: string } }> }>;
    expect(suites[0].tests[0].error.category).toBe('framework');
  });

  it('defaults to category:framework for unknown error class names', () => {
    const stack = 'TypeError: cannot read property\n  at foo.ts:1:1';
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Test', { status: 'failed', errors: [{ message: 'oops', stack }] }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ error: { category: string } }> }>;
    expect(suites[0].tests[0].error.category).toBe('framework');
  });

  it('extracts category:user from YamlValidationError and UnresolvedPlaceholderError', () => {
    const yamlStack = 'YamlValidationError: bad schema\n  at schema.ts:1:1';
    const placeholderStack = 'UnresolvedPlaceholderError: ENV.FOO not found\n  at resolver.ts:1:1';

    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('T1', { status: 'failed', errors: [{ message: 'bad schema', stack: yamlStack }] }),
        makeTest('T2', { status: 'failed', errors: [{ message: 'ENV.FOO not found', stack: placeholderStack }] }),
      ]),
    ], makeFullResult('failed')) as Record<string, unknown>;

    const tests = (result.suites as Array<{ tests: Array<{ error: { category: string } }> }>)[0].tests;
    expect(tests[0].error.category).toBe('user');
    expect(tests[1].error.category).toBe('user');
  });

  it('sets error to null for passing tests', () => {
    const result = runReporter([
      makeProjectSuite('chromium', [makeTest('OK test', { status: 'passed' })]),
    ]) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ error: unknown }> }>;
    expect(suites[0].tests[0].error).toBeNull();
  });

  it('captures retry count from the last test result', () => {
    const result = runReporter([
      makeProjectSuite('chromium', [
        makeTest('Flaky test', { status: 'passed', retry: 2 }),
      ]),
    ]) as Record<string, unknown>;

    const suites = result.suites as Array<{ tests: Array<{ retries: number }> }>;
    expect(suites[0].tests[0].retries).toBe(2);
  });

  it('includes startedAt as an ISO 8601 string', () => {
    const result = runReporter([], makeFullResult()) as Record<string, unknown>;
    expect(typeof result.startedAt).toBe('string');
    expect(() => new Date(result.startedAt as string)).not.toThrow();
  });

  it('produces empty suites for a run with no tests', () => {
    const result = runReporter([]) as Record<string, unknown>;
    expect(result.total).toBe(0);
    expect(result.suites).toEqual([]);
  });
});
