/**
 * Playwright entry point.
 *
 * This file is picked up by Playwright (via playwright.config.ts → testMatch)
 * and dynamically generates `test()` blocks from discovered YAML definitions.
 *
 * It MUST NOT be imported directly. It is a test file, not a library module.
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as url from 'url';
import { loadConfig } from '../config/index.js';
import {
  discoverTests,
  loadPageObjectRegistry,
  loadSuiteDefinition,
  resolveSuiteTests,
  loadTestDefinition,
  type DiscoveredTest,
} from '../loader/index.js';
import { DatabaseConnection } from '../executor/db-connection.js';
import { runTest } from './test-runner.js';
import { resolveFromRoot } from '../utils/path-resolution.js';

// ─── Resolve Project Root ─────────────────────────────────────────────────────

// dist/runner/ → project root (two levels up from compiled output)
const PROJECT_ROOT = path.resolve(url.fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// ─── Load Config & Discover Tests ─────────────────────────────────────────────

const { frameworkConfig, env } = loadConfig(PROJECT_ROOT);

// RunConfig is passed from the CLI via environment variables set before spawning Playwright
const envTags = process.env['SPEARE_TAGS']?.split(',').filter(Boolean) ?? [];
const envExcludeTags = process.env['SPEARE_EXCLUDE_TAGS']?.split(',').filter(Boolean) ?? [];
const envSingleFile = process.env['SPEARE_TEST_FILE'] ?? undefined;
const envSuiteName = process.env['SPEARE_SUITE'] ?? undefined;

let discoveredTests: DiscoveredTest[];

if (envSuiteName) {
  const suitePath = resolveFromRoot(PROJECT_ROOT, `suites/${envSuiteName}.yaml`);
  const suite = loadSuiteDefinition(suitePath);
  const orderedTests = resolveSuiteTests(PROJECT_ROOT, suite);
  discoveredTests = orderedTests.map(({ filePath }) => ({
    filePath,
    definition: loadTestDefinition(filePath),
  }));
} else {
  discoveredTests = await discoverTests({
    projectRoot: PROJECT_ROOT,
    tags: envTags,
    excludeTags: envExcludeTags,
    singleFile: envSingleFile,
  });
}

const pageObjects = await loadPageObjectRegistry(PROJECT_ROOT);

// ─── Generate Playwright Test Blocks ─────────────────────────────────────────

for (const { definition, filePath } of discoveredTests) {
  const tags = (definition.tags ?? []).map((t) => `@${t}`).join(' ');
  const testTitle = tags ? `${definition.name} ${tags}` : definition.name;

  test.describe(testTitle, () => {
    // Test-level retries applied to the outer describe block so Playwright retries the full test
    test.describe.configure({ retries: definition.retry ?? frameworkConfig.retries ?? 0 });

    test(definition.name, async ({ page, context: browserContext, request }) => {
      const dbConnection = frameworkConfig.database
        ? new DatabaseConnection(frameworkConfig.database)
        : null;

      await runTest({
        definition,
        filePath,
        config: frameworkConfig,
        env,
        pageObjects,
        projectRoot: PROJECT_ROOT,
        page,
        browserContext,
        request,
        dbConnection,
      });
    });
  });
}
