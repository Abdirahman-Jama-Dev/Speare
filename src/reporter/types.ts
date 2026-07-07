import type { ErrorCategory } from '../types/errors.js';

export type RunStatus = 'passed' | 'failed' | 'error';

export interface StepError {
  readonly category: ErrorCategory;
  readonly message: string;
  readonly stack: string;
}

export interface TestResultEntry {
  readonly name: string;
  readonly status: RunStatus;
  readonly duration: number;
  readonly retries: number;
  readonly error: StepError | null;
}

export interface SuiteResult {
  readonly name: string;
  readonly status: RunStatus;
  readonly tests: readonly TestResultEntry[];
}

export interface WorkerResult {
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly duration: number;
  readonly passed: number;
  readonly failed: number;
  readonly total: number;
  readonly suites: readonly SuiteResult[];
}
