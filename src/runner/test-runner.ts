import * as path from 'path';
import type { Page, BrowserContext, APIRequestContext } from 'playwright';
import type { TestDefinition, PageObjectDefinition, FrameworkConfig } from '../types/index.js';
import type { DbQueryRunner } from '../types/db.js';
import { buildRuntimeContext } from '../resolver/runtime-context.js';
import { loadRoleData, resolveDataImports } from '../loader/index.js';
import { resolveFromRoot } from '../utils/path-resolution.js';
import { logger } from '../utils/logger.js';
import { buildDefaultRegistry } from '../executor/index.js';
import { runSteps } from './retry.js';
import { runHook } from './hooks.js';
import { SpeareError, AppError, FrameworkError } from '../types/errors.js';

// ─── Test Run Parameters ───────────────────────────────────────────────────────

export interface TestRunParams {
  readonly definition: TestDefinition;
  readonly filePath: string;
  readonly config: FrameworkConfig;
  readonly env: Readonly<Record<string, string>>;
  readonly pageObjects: ReadonlyMap<string, PageObjectDefinition>;
  readonly projectRoot: string;
  readonly page: Page;
  readonly browserContext: BrowserContext;
  readonly request: APIRequestContext;
  /** Null when no database is configured in framework.config.yaml. */
  readonly dbConnection: DbQueryRunner | null;
}

// ─── Runtime Context Builder ───────────────────────────────────────────────────

function buildTestRuntimeContext(params: TestRunParams) {
  const { definition, config, env, projectRoot, page, browserContext, request, pageObjects, dbConnection } = params;

  const roleData: Record<string, unknown> = {};
  if (definition.role) {
    const rolePath = resolveFromRoot(projectRoot, `data/roles/${definition.role}.yaml`);
    const loaded = loadRoleData(rolePath);
    Object.assign(roleData, loaded);
  }

  const dataImports = resolveDataImports(projectRoot, definition);
  const testVariables = definition.variables ?? {};

  return buildRuntimeContext({
    config,
    env,
    roleData,
    testVariables,
    dataImports,
    page,
    browserContext,
    apiContext: request,
    pageObjects,
    projectRoot,
    testName: definition.name,
    dbConnection,
  });
}

export async function runTest(params: TestRunParams): Promise<void> {
  const { definition } = params;

  const registry = buildDefaultRegistry();

  // Connect database before any steps run
  if (params.dbConnection && 'connect' in params.dbConnection) {
    await (params.dbConnection as { connect(): Promise<void> }).connect();
  }

  let ctx = buildTestRuntimeContext(params);

  try {
    ctx = await runHook('beforeAll', definition.hooks, ctx, registry);
    ctx = await runHook('beforeEach', definition.hooks, ctx, registry);
    ctx = await runSteps(definition.steps, ctx, registry, 0);
  } catch (err) {
    const classified = classifyError(err);
    logger.error(`Test failed: "${definition.name}"`, {
      error:    classified.message,
      category: classified.category,
      file:     path.relative(params.projectRoot, params.filePath),
    });
    throw classified;
  } finally {
    // Cleanup hooks always run, even on failure
    try {
      ctx = await runHook('afterEach', definition.hooks, ctx, registry);
    } catch (cleanupErr) {
      logger.warn('afterEach hook failed', {
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }

    try {
      await runHook('afterAll', definition.hooks, ctx, registry);
    } catch (cleanupErr) {
      logger.warn('afterAll hook failed', {
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    }

    // Rollback DB transaction and close connection
    if (params.dbConnection) {
      await params.dbConnection.teardown();
    }

    // Unroute all mocks (belt-and-suspenders; BrowserContext.close() also cleans them)
    await params.page.unrouteAll();
  }
}

// ─── Error Classification ─────────────────────────────────────────────────────

/**
 * Ensure every error that surfaces from a test has a SpeareError category.
 * Already-classified errors pass through. Playwright TimeoutErrors are
 * treated as AppErrors (the app didn't respond). Everything else is a
 * FrameworkError — it means Speare encountered something it didn't expect.
 */
function classifyError(err: unknown): SpeareError {
  if (err instanceof SpeareError) return err;

  const message = err instanceof Error ? err.message : String(err);

  // Playwright timeout → the application under test didn't respond as expected
  if (err instanceof Error && err.constructor.name === 'TimeoutError') {
    return new AppError(`Playwright timeout: ${message}`);
  }

  return new FrameworkError(`Unexpected error: ${message}`);
}
