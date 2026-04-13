import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import type { GenerateStep, StepExecutor, RuntimeContext } from '../types/index.js';

// ─── Generator Dispatch ────────────────────────────────────────────────────────

/**
 * Resolve a generator expression to a value.
 * Supports:
 *   faker.<module>.<method>   — delegates to @faker-js/faker
 *   uuid                      — crypto.randomUUID()
 */
function generate(expression: string): unknown {
  if (expression === 'uuid') {
    return randomUUID();
  }

  if (expression.startsWith('faker.')) {
    const parts = expression.slice('faker.'.length).split('.');
    let current: unknown = faker;
    for (const part of parts) {
      if (typeof current !== 'object' || current === null) {
        throw new Error(`Invalid faker path: "${expression}" — "${part}" is not an object`);
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (typeof current !== 'function') {
      throw new Error(`Invalid faker path: "${expression}" — does not resolve to a function`);
    }
    return (current as () => unknown)();
  }

  throw new Error(
    `Unknown generator expression: "${expression}". ` +
      `Supported: "uuid" or "faker.<module>.<method>" (e.g. "faker.internet.email")`,
  );
}

// ─── Generate Executor ─────────────────────────────────────────────────────────

/** Stateless — no constructor args needed. */
export class GenerateExecutor implements StepExecutor<GenerateStep> {
  readonly type = 'generate';

  async execute(step: GenerateStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    let updatedCtx: RuntimeContext = ctx;

    for (const [key, expression] of Object.entries(step.generate)) {
      const value = generate(expression);
      updatedCtx = updatedCtx.save(key, value);
    }

    return updatedCtx;
  }
}
