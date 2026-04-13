// ─── Selector Types ────────────────────────────────────────────────────────────

export type SelectorType =
  | 'role'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'testId'
  | 'alt'
  | 'title';

export interface SelectorDefinition {
  readonly type: SelectorType;
  readonly value: string;
  readonly options?: Record<string, unknown>;
}

export interface SelectorMap {
  readonly [name: string]: SelectorDefinition;
}

// ─── Page Object ───────────────────────────────────────────────────────────────

export interface PageAction {
  readonly action: 'fill' | 'click' | 'select' | 'check' | 'uncheck' | 'hover' | 'press';
  readonly selector: string;
  readonly value?: string;
}

export interface PageObjectDefinition {
  readonly name: string;
  readonly url?: string;
  readonly requires?: readonly string[];
  readonly selectors: SelectorMap;
  readonly actions: Record<string, readonly PageAction[]>;
}

// ─── Role Data ─────────────────────────────────────────────────────────────────

export type RoleData = Record<string, string>;

// ─── Mock ──────────────────────────────────────────────────────────────────────

export interface MockDefinition {
  readonly url: string;
  readonly method?: string;
  readonly response: {
    readonly status: number;
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
  };
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

export interface SuiteTestEntry {
  readonly path: string;
  readonly order?: number;
}

export interface SuiteConfigOverride {
  readonly retries?: number;
  readonly workers?: number;
  readonly timeout?: number;
}

export interface SuiteDefinition {
  readonly name: string;
  readonly config?: SuiteConfigOverride;
  readonly matrix?: Record<string, readonly string[]>;
  readonly tests: ReadonlyArray<string | SuiteTestEntry>;
}

// ─── Framework Config ──────────────────────────────────────────────────────────

export interface ParallelConfig {
  readonly shard?: boolean;
  readonly shardCount?: number;
  readonly workers?: number;
}

export interface DatabaseConfig {
  readonly driver: 'postgres' | 'mysql' | 'sqlite' | 'mssql';
  readonly connectionString: string;
  readonly ssl?: boolean;
  readonly queryTimeout?: number;
  readonly isolationMode?: 'readonly' | 'transaction' | 'none';
}

export interface SecurityConfig {
  readonly allowEval?: boolean;
}

export interface VisualConfig {
  readonly threshold?: number;
  readonly baselineDir?: string;
}

export interface FrameworkConfig {
  readonly baseUrl?: string;
  readonly apiBaseUrl?: string;
  readonly retries?: number;
  readonly timeout?: number;
  readonly parallel?: ParallelConfig;
  readonly database?: DatabaseConfig;
  readonly security?: SecurityConfig;
  readonly visual?: VisualConfig;
  readonly reporters?: readonly string[];
}
