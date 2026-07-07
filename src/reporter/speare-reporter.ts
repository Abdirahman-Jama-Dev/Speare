import type { Reporter, Suite, TestCase, TestResult, FullResult, FullConfig } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import type { WorkerResult, SuiteResult, TestResultEntry, StepError, RunStatus } from './types.js';
import type { ErrorCategory } from '../types/errors.js';

// ─── Error Category Extraction ─────────────────────────────────────────────────
//
// Playwright serialises thrown errors to { message, stack } — the Error object
// itself is not available in the reporter. We recover the Speare category by
// reading the class name from the first line of the stack trace, which always
// takes the form "ClassName: message".
//
// The map is derived from the SpeareError hierarchy in src/types/errors.ts and
// must be updated if new subclasses are added.

const ERROR_CATEGORY_MAP: Readonly<Record<string, ErrorCategory>> = {
  UserError:                  'user',
  YamlValidationError:        'user',
  UnresolvedPlaceholderError: 'user',
  AppError:                   'app',
  FrameworkError:             'framework',
};

function categoryFromStack(stack: string | undefined): ErrorCategory {
  const firstLine = stack?.split('\n')[0] ?? '';
  const className = firstLine.split(':')[0]?.trim() ?? '';
  return ERROR_CATEGORY_MAP[className] ?? 'framework';
}

// ─── Status Helpers ────────────────────────────────────────────────────────────

function toRunStatus(status: TestResult['status']): RunStatus {
  if (status === 'passed' || status === 'skipped') return 'passed';
  return 'failed';
}

function suiteStatus(tests: readonly TestResultEntry[]): RunStatus {
  return tests.some(t => t.status !== 'passed') ? 'failed' : 'passed';
}

// ─── Result Builder ────────────────────────────────────────────────────────────

function buildTestEntry(test: TestCase): TestResultEntry {
  const result = test.results.at(-1);

  if (!result) {
    return { name: test.title, status: 'error', duration: 0, retries: 0, error: null };
  }

  const rawError = result.errors[0];
  const error: StepError | null = rawError
    ? {
        category: categoryFromStack(rawError.stack),
        message:  rawError.message ?? '',
        stack:    rawError.stack   ?? '',
      }
    : null;

  return {
    name:     test.title,
    status:   toRunStatus(result.status),
    duration: result.duration,
    retries:  result.retry,
    error,
  };
}

// ─── Reporter ─────────────────────────────────────────────────────────────────

export default class SpeareReporter implements Reporter {
  private readonly outputFile: string;
  private rootSuite: Suite | null = null;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? 'reports/results.json';
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
  }

  onEnd(result: FullResult): void {
    const suites: SuiteResult[] = (this.rootSuite?.suites ?? []).map(projectSuite => {
      const tests = projectSuite.allTests().map(buildTestEntry);
      return { name: projectSuite.title, status: suiteStatus(tests), tests };
    });

    const allTests = suites.flatMap(s => s.tests);
    const passed   = allTests.filter(t => t.status === 'passed').length;
    const failed   = allTests.length - passed;

    const output: WorkerResult = {
      status:    result.status === 'passed' ? 'passed' : result.status === 'failed' ? 'failed' : 'error',
      startedAt: result.startTime.toISOString(),
      duration:  result.duration,
      passed,
      failed,
      total:     allTests.length,
      suites,
    };

    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, JSON.stringify(output, null, 2), 'utf-8');
  }
}
