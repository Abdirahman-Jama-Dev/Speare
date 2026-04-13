import { resolveDeep, interpolateString, type ResolutionLayers } from './placeholder-resolver.js';
import type { ExecutionContext, ResolutionSnapshot, FrameworkConfig } from '../types/index.js';

// ─── Concrete Resolution Context ───────────────────────────────────────────────

export class ConcreteExecutionContext implements ExecutionContext {
  readonly config: FrameworkConfig;
  readonly resolution: ResolutionSnapshot;

  constructor(config: FrameworkConfig, layers: ResolutionLayers) {
    this.config = config;
    this.resolution = {
      env: layers.env,
      testData: layers.testData,
      stepOutputs: layers.stepOutputs,
    };
  }

  private get layers(): ResolutionLayers {
    return {
      env: this.resolution.env,
      testData: this.resolution.testData,
      stepOutputs: this.resolution.stepOutputs,
    };
  }

  save(key: string, value: unknown): ExecutionContext {
    const updatedOutputs = { ...this.resolution.stepOutputs, [key]: value };
    return new ConcreteExecutionContext(this.config, {
      env: this.resolution.env,
      testData: this.resolution.testData,
      stepOutputs: updatedOutputs,
    });
  }

  resolve(placeholder: string, stepIndex: number, stepType: string): unknown {
    return interpolateString(placeholder, this.layers, stepIndex, stepType);
  }

  resolveDeep<T>(value: T, stepIndex: number, stepType: string): T {
    return resolveDeep(value, this.layers, stepIndex, stepType) as T;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

/**
 * Build the initial ExecutionContext for a test.
 * stepOutputs starts empty and accumulates as steps run.
 */
export function buildExecutionContext(params: {
  config: FrameworkConfig;
  env: Readonly<Record<string, string>>;
  roleData: Readonly<Record<string, unknown>>;
  testVariables: Readonly<Record<string, unknown>>;
  dataImports: Readonly<Record<string, unknown>>;
}): ExecutionContext {
  const { config, env, roleData, testVariables, dataImports } = params;

  // Layer 2 precedence: test variables > data imports > role data
  const testData: Record<string, unknown> = {
    ...roleData,
    ...dataImports,
    ...testVariables,
  };

  return new ConcreteExecutionContext(config, {
    env,
    testData,
    stepOutputs: {},
  });
}
