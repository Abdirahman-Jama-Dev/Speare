import * as path from 'path';
import { loadSuiteDefinition, expandMatrixSuite } from '../loader/index.js';
import { loadConfig } from '../config/index.js';
import type { SuiteDefinition, FrameworkConfig } from '../types/index.js';
import { resolveFromRoot } from '../utils/path-resolution.js';
import { logger } from '../utils/logger.js';

// ─── Suite Runner ─────────────────────────────────────────────────────────────
//
// This module is used for non-browser operations (dry-run, validate).
// Actual browser test execution is orchestrated by playwright-entry.ts,
// which discovers and registers tests with Playwright's test runner.
// ─────────────────────────────────────────────────────────────────────────────

export interface SuiteRunSummary {
  readonly suiteName: string;
  readonly matrixLabel: string;
  readonly testPaths: readonly string[];
  readonly effectiveConfig: FrameworkConfig;
}

/**
 * Load a suite definition and return a summary of test paths and config overrides.
 * Used by dry-run and validate commands that need suite-level test discovery
 * without launching a browser.
 */
export function describeSuite(suitePath: string, projectRoot: string): SuiteRunSummary[] {
  const { frameworkConfig } = loadConfig(projectRoot);
  const suite: SuiteDefinition = loadSuiteDefinition(resolveFromRoot(projectRoot, suitePath));

  const effectiveConfig: FrameworkConfig = {
    ...frameworkConfig,
    retries: suite.config?.retries ?? frameworkConfig.retries,
    timeout: suite.config?.timeout ?? frameworkConfig.timeout,
    parallel: {
      ...frameworkConfig.parallel,
      workers: suite.config?.workers ?? frameworkConfig.parallel?.workers,
    },
  };

  const matrixRuns = expandMatrixSuite(projectRoot, suite);

  return matrixRuns.map(({ matrixEnv, tests }) => {
    const matrixLabel = Object.entries(matrixEnv)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    if (matrixLabel) {
      logger.info(`Suite "${suite.name}" matrix: ${matrixLabel}`);
    }

    return {
      suiteName: suite.name,
      matrixLabel,
      testPaths: tests.map(({ filePath }) => path.relative(projectRoot, filePath)),
      effectiveConfig,
    };
  });
}

// Keep the old runSuite export to avoid breaking imports, but it now delegates to describeSuite.
export async function runSuite(suitePath: string, projectRoot: string): Promise<void> {
  const summaries = describeSuite(suitePath, projectRoot);
  for (const { suiteName, matrixLabel, testPaths } of summaries) {
    const label = matrixLabel ? ` [${matrixLabel}]` : '';
    logger.info(
      `Suite "${suiteName}"${label}: ${testPaths.length} test(s).\n` +
        `  Use the CLI to run: npm test -- --suite <name>`,
    );
  }
}
