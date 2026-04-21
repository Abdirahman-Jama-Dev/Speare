import type { SelectorDefinition } from './config.js';

// ─── Base ──────────────────────────────────────────────────────────────────────

interface BaseStep {
  readonly retry?: number;
  readonly retryDelay?: number;
}

// ─── UI Step ───────────────────────────────────────────────────────────────────

export interface UiStep extends BaseStep {
  readonly ui: {
    readonly pageObject: string;
    readonly action: string;
    readonly args?: Record<string, string>;
  };
}

// ─── API Step ──────────────────────────────────────────────────────────────────

export interface ApiAssert {
  readonly status?: number;
  readonly jsonPath?: string;
  readonly equals?: unknown;
  readonly contains?: unknown;
  readonly greaterThan?: number;
  readonly lessThan?: number;
}

export interface ApiStepConfig {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly assert?: ApiAssert;
  readonly save?: Record<string, string>;
}

export interface ApiStep extends BaseStep {
  readonly api: ApiStepConfig;
}

// ─── Assert Step ───────────────────────────────────────────────────────────────

export interface AssertStep extends BaseStep {
  readonly assert: {
    readonly selector: SelectorDefinition;
    readonly visible?: boolean;
    readonly text?: string;
    readonly value?: string;
    readonly count?: number;
    readonly enabled?: boolean;
    readonly checked?: boolean;
  };
}

// ─── Mock Step ─────────────────────────────────────────────────────────────────

export type MockStep = BaseStep & (
  | { readonly mock: string }
  | {
      readonly mock: {
        readonly url: string;
        readonly method?: string;
        readonly response: {
          readonly status: number;
          readonly body?: unknown;
          readonly headers?: Record<string, string>;
        };
      };
    }
);

// ─── Generate Step ─────────────────────────────────────────────────────────────

export interface GenerateStep extends BaseStep {
  readonly generate: Record<string, string>;
}

// ─── Screenshot Step ───────────────────────────────────────────────────────────

export interface ScreenshotStep extends BaseStep {
  readonly screenshot: {
    readonly name: string;
    readonly fullPage?: boolean;
    readonly threshold?: number;
  };
}

// ─── Accessibility Step ────────────────────────────────────────────────────────

export interface A11yStep extends BaseStep {
  readonly a11y: {
    readonly run: boolean;
    readonly severity?: ReadonlyArray<'critical' | 'serious' | 'moderate' | 'minor'>;
    readonly include?: readonly string[];
    readonly exclude?: readonly string[];
  };
}

// ─── Measure Step ─────────────────────────────────────────────────────────────

export interface MeasureThresholds {
  readonly loadTime?: number;
  readonly largestContentfulPaint?: number;
  readonly cumulativeLayoutShift?: number;
  readonly firstContentfulPaint?: number;
  readonly timeToInteractive?: number;
}

export type MetricName = keyof MeasureThresholds;

export interface MeasureStep extends BaseStep {
  readonly measure: {
    readonly label: string;
    readonly metrics: readonly MetricName[];
    readonly thresholds?: MeasureThresholds;
  };
}

// ─── DB Step ───────────────────────────────────────────────────────────────────

export interface DbAssert {
  readonly rowCount?: number;
  readonly column?: string;
  readonly equals?: unknown;
}

export interface DbStep extends BaseStep {
  readonly db: {
    readonly query: string;
    readonly assert?: DbAssert;
    readonly save?: Record<string, string>;
  };
}

// ─── Eval Step ─────────────────────────────────────────────────────────────────

export interface EvalStep extends BaseStep {
  readonly eval: {
    readonly script: string;
    readonly input?: Record<string, string>;
    readonly output?: string;
  };
}

// ─── Navigate Step ─────────────────────────────────────────────────────────────

export interface NavigateStep extends BaseStep {
  readonly navigate: {
    readonly url: string;
    /** Wait for a specific load state before continuing. Default: 'load' */
    readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  };
}

// ─── Union ─────────────────────────────────────────────────────────────────────

export type AnyStep =
  | UiStep
  | ApiStep
  | AssertStep
  | MockStep
  | GenerateStep
  | ScreenshotStep
  | A11yStep
  | MeasureStep
  | DbStep
  | EvalStep
  | NavigateStep;

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export type HookStep = ApiStep | DbStep;

export interface Hooks {
  readonly beforeAll?: readonly HookStep[];
  readonly afterAll?: readonly HookStep[];
  readonly beforeEach?: readonly HookStep[];
  readonly afterEach?: readonly HookStep[];
}

// ─── Test Definition ───────────────────────────────────────────────────────────

export interface DataImport {
  readonly import: string;
}

export interface TestDefinition {
  readonly name: string;
  readonly tags?: readonly string[];
  readonly role?: string;
  readonly retry?: number;
  readonly data?: ReadonlyArray<DataImport | Record<string, unknown>>;
  readonly variables?: Record<string, unknown>;
  readonly hooks?: Hooks;
  readonly steps: readonly AnyStep[];
}
