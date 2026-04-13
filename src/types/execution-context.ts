import type { Page, BrowserContext, APIRequestContext } from 'playwright';
import type { FrameworkConfig, PageObjectDefinition } from './config.js';
import type { DbQueryRunner } from './db.js';

/**
 * Immutable resolved context passed through the execution pipeline.
 * Layer 1 (step outputs) is accumulated via save() during execution.
 */
export interface ResolutionSnapshot {
  readonly env: Readonly<Record<string, string>>;
  readonly testData: Readonly<Record<string, unknown>>;
  readonly stepOutputs: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly config: FrameworkConfig;
  readonly resolution: ResolutionSnapshot;
  save(key: string, value: unknown): ExecutionContext;
  resolve(placeholder: string, stepIndex: number, stepType: string): unknown;
  resolveDeep<T>(value: T, stepIndex: number, stepType: string): T;
}

/**
 * Full runtime context including Playwright browser handles.
 * Passed to every step executor. Covariant save() preserves all handles.
 */
export interface RuntimeContext extends ExecutionContext {
  readonly page: Page;
  readonly browserContext: BrowserContext;
  readonly apiContext: APIRequestContext;
  readonly pageObjects: ReadonlyMap<string, PageObjectDefinition>;
  readonly projectRoot: string;
  readonly testName: string;
  readonly dbConnection: DbQueryRunner | null;
  save(key: string, value: unknown): RuntimeContext;
}
