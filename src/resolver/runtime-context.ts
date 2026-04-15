import type { Page, BrowserContext, APIRequestContext } from 'playwright';
import type {
  FrameworkConfig,
  PageObjectDefinition,
  DbQueryRunner,
  RuntimeContext,
} from '../types/index.js';
import { resolveEnvPlaceholders } from '../config/index.js';
import { ConcreteExecutionContext } from './resolution-context.js';
import type { ResolutionLayers } from './placeholder-resolver.js';

// ─── Concrete Runtime Context ─────────────────────────────────────────────────

/**
 * Full runtime context passed to every step executor.
 * Extends the resolution context with Playwright handles and project metadata.
 * Immutable — save() returns a new ConcreteRuntimeContext with updated outputs.
 */
export class ConcreteRuntimeContext extends ConcreteExecutionContext implements RuntimeContext {
  readonly page: Page;
  readonly browserContext: BrowserContext;
  readonly apiContext: APIRequestContext;
  readonly pageObjects: ReadonlyMap<string, PageObjectDefinition>;
  readonly projectRoot: string;
  readonly testName: string;
  readonly dbConnection: DbQueryRunner | null;

  // Expose parent's protected layers getter as public for RuntimeContext interface
  override get layers(): ResolutionLayers {
    return super.layers;
  }

  constructor(
    config: FrameworkConfig,
    layers: ResolutionLayers,
    handles: {
      readonly page: Page;
      readonly browserContext: BrowserContext;
      readonly apiContext: APIRequestContext;
      readonly pageObjects: ReadonlyMap<string, PageObjectDefinition>;
      readonly projectRoot: string;
      readonly testName: string;
      readonly dbConnection: DbQueryRunner | null;
    },
  ) {
    super(config, layers);
    this.page = handles.page;
    this.browserContext = handles.browserContext;
    this.apiContext = handles.apiContext;
    this.pageObjects = handles.pageObjects;
    this.projectRoot = handles.projectRoot;
    this.testName = handles.testName;
    this.dbConnection = handles.dbConnection;
  }

  /**
   * Returns a new ConcreteRuntimeContext with the key added to stepOutputs.
   * All Playwright handles are carried forward unchanged.
   */
  override save(key: string, value: unknown): ConcreteRuntimeContext {
    const updatedOutputs = { ...this.resolution.stepOutputs, [key]: value };
    return new ConcreteRuntimeContext(
      this.config,
      {
        env: this.resolution.env,
        testData: this.resolution.testData,
        stepOutputs: updatedOutputs,
      },
      {
        page: this.page,
        browserContext: this.browserContext,
        apiContext: this.apiContext,
        pageObjects: this.pageObjects,
        projectRoot: this.projectRoot,
        testName: this.testName,
        dbConnection: this.dbConnection,
      },
    );
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildRuntimeContext(params: {
  readonly config: FrameworkConfig;
  readonly env: Readonly<Record<string, string>>;
  readonly roleData: Readonly<Record<string, unknown>>;
  readonly testVariables: Readonly<Record<string, unknown>>;
  readonly dataImports: Readonly<Record<string, unknown>>;
  readonly page: Page;
  readonly browserContext: BrowserContext;
  readonly apiContext: APIRequestContext;
  readonly pageObjects: ReadonlyMap<string, PageObjectDefinition>;
  readonly projectRoot: string;
  readonly testName: string;
  readonly dbConnection: DbQueryRunner | null;
}): ConcreteRuntimeContext {
  // Layer 2: test variables > data imports > role data
  // Pre-resolve ENV.* references in role data and data imports so that
  // {username} → "ENV.ADMIN_USERNAME" → actual value from .env
  const resolvedRoleData = resolveEnvPlaceholders(params.roleData, params.env as Record<string, string>);
  const resolvedDataImports = resolveEnvPlaceholders(params.dataImports, params.env as Record<string, string>);
  const testData: Record<string, unknown> = {
    ...resolvedRoleData,
    ...resolvedDataImports,
    ...params.testVariables,
  };

  return new ConcreteRuntimeContext(
    params.config,
    { env: params.env, testData, stepOutputs: {} },
    {
      page: params.page,
      browserContext: params.browserContext,
      apiContext: params.apiContext,
      pageObjects: params.pageObjects,
      projectRoot: params.projectRoot,
      testName: params.testName,
      dbConnection: params.dbConnection,
    },
  );
}
