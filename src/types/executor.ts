import type { AnyStep } from './steps.js';
import type { RuntimeContext } from './execution-context.js';

/**
 * Contract that every step executor must satisfy.
 * T is the fully-typed step config after schema validation.
 *
 * Executors are stateless — all Playwright handles and project metadata are
 * obtained through RuntimeContext rather than constructor arguments.
 */
export interface StepExecutor<T extends AnyStep = AnyStep> {
  /** Matches the top-level key in the YAML step (ui, api, assert, etc.) */
  readonly type: string;

  /**
   * Execute the step. Returns an updated RuntimeContext (for save: support).
   * Must throw on failure — never swallow errors.
   */
  execute(step: T, ctx: RuntimeContext): Promise<RuntimeContext>;
}
