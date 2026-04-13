import * as path from 'path';
import { loadConfig } from '../config/index.js';
import {
  discoverTests,
  loadPageObjectRegistry,
  loadSuiteDefinition,
  expandMatrixSuite,
  loadTestDefinition,
  resolveDataImports,
} from '../loader/index.js';
import { loadRoleData } from '../loader/index.js';
import { buildExecutionContext, formatDryRunReport } from '../resolver/index.js';
import { resolveFromRoot } from '../utils/path-resolution.js';
import type { RunConfig } from '../types/index.js';

// ─── Dry Run ──────────────────────────────────────────────────────────────────

/**
 * Run dry-run mode: resolve all variables for each matching test and print
 * the resolution table. Exits 0 if all tests resolve without errors.
 * Exits 1 if any placeholder is unresolved.
 */
export async function runDryRun(runConfig: RunConfig): Promise<void> {
  const { projectRoot } = runConfig;
  const { frameworkConfig, env } = loadConfig(projectRoot);
  const pageObjects = await loadPageObjectRegistry(projectRoot);

  void pageObjects; // page objects are validated but not needed for variable display

  const tests = await discoverTests({
    projectRoot,
    tags: runConfig.tags,
    excludeTags: runConfig.excludeTags,
    singleFile: runConfig.testFile ?? undefined,
  });

  if (tests.length === 0) {
    process.stdout.write('[dry-run] No matching tests found.\n');
    return;
  }

  let hasError = false;

  for (const { definition, filePath } of tests) {
    try {
      const roleData: Record<string, unknown> = {};
      if (definition.role) {
        const rolePath = resolveFromRoot(projectRoot, `data/roles/${definition.role}.yaml`);
        const loaded = loadRoleData(rolePath);
        Object.assign(roleData, loaded);
      }

      const dataImports = resolveDataImports(projectRoot, definition);
      const testVariables = definition.variables ?? {};

      const ctx = buildExecutionContext({
        config: frameworkConfig,
        env,
        roleData,
        testVariables,
        dataImports,
      });

      const report = formatDryRunReport(
        {
          env: ctx.resolution.env,
          testData: ctx.resolution.testData,
          stepOutputs: ctx.resolution.stepOutputs,
        },
        definition.name,
      );

      process.stdout.write(report + '\n');
    } catch (err) {
      hasError = true;
      process.stderr.write(
        `[dry-run] ERROR in "${path.relative(projectRoot, filePath)}":\n` +
          `  ${err instanceof Error ? err.message : String(err)}\n\n`,
      );
    }
  }

  if (hasError) {
    process.exit(1);
  }
}
