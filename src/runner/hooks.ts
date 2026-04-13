import type { Hooks, HookStep, RuntimeContext } from '../types/index.js';
import type { ExecutorRegistry } from '../executor/registry.js';
import { runSteps } from './retry.js';

// ─── Hook Runner ──────────────────────────────────────────────────────────────

export type HookName = keyof Hooks;

/**
 * Run a named hook's steps, returning the (potentially updated) RuntimeContext.
 * Hook steps are API or DB steps — they participate in variable resolution
 * and can produce save: outputs that flow into the main test steps.
 */
export async function runHook(
  hookName: HookName,
  hooks: Hooks | undefined,
  ctx: RuntimeContext,
  registry: ExecutorRegistry,
): Promise<RuntimeContext> {
  const hookSteps = hooks?.[hookName] as readonly HookStep[] | undefined;
  if (!hookSteps || hookSteps.length === 0) return ctx;

  return runSteps(hookSteps, ctx, registry, 0);
}
