import type { StepExecutor, AnyStep, ExecutionContext, RuntimeContext } from '../types/index.js';

export class ExecutorRegistry {
  private readonly executors = new Map<string, StepExecutor>();

  register(executor: StepExecutor): void {
    if (this.executors.has(executor.type)) {
      throw new Error(`Executor already registered for step type: "${executor.type}"`);
    }
    this.executors.set(executor.type, executor);
  }

  detectType(step: AnyStep): string {
    const keys = Object.keys(step);
    for (const key of keys) {
      if (this.executors.has(key)) return key;
    }
    throw new Error(
      `Unknown step type. Keys found: [${keys.join(', ')}].\n` +
        `Registered types: [${[...this.executors.keys()].join(', ')}]`,
    );
  }

  /**
   * Execute a step. Callers are expected to pass a RuntimeContext; the
   * ExecutionContext return type is widened for compatibility with the
   * registry's public interface. Use `as RuntimeContext` at call sites
   * when the full handle set is required.
   */
  async execute(step: AnyStep, context: ExecutionContext): Promise<ExecutionContext> {
    const type = this.detectType(step);
    const executor = this.executors.get(type);
    if (!executor) throw new Error(`No executor found for step type: "${type}"`);
    // All callers pass RuntimeContext instances; the cast is safe at runtime.
    return executor.execute(step, context as RuntimeContext);
  }
}
