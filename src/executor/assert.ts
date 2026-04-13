import type { AssertStep, StepExecutor, RuntimeContext } from '../types/index.js';
import { buildLocatorFromDefinition } from './locator-builder.js';

// ─── Assert Executor ───────────────────────────────────────────────────────────
//
// Uses native Playwright Locator API — no dependency on @playwright/test's expect().
// All assertions use waitFor / locator methods with explicit error messages.
// Stateless — page handle obtained from RuntimeContext.
// ──────────────────────────────────────────────────────────────────────────────

export class AssertExecutor implements StepExecutor<AssertStep> {
  readonly type = 'assert';

  async execute(step: AssertStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const config = ctx.resolveDeep(step.assert, -1, 'assert');
    const selector = config.selector;
    const locator = buildLocatorFromDefinition(ctx.page, selector);
    const label = `${selector.type as string}="${selector.value as string}"`;

    if (config.visible === true) {
      await locator.waitFor({ state: 'visible' }).catch(() => {
        throw new Error(`Assert failed: expected element (${label}) to be visible`);
      });
    } else if (config.visible === false) {
      await locator.waitFor({ state: 'hidden' }).catch(() => {
        throw new Error(`Assert failed: expected element (${label}) to be hidden`);
      });
    }

    if (config.text !== undefined) {
      const actual = (await locator.textContent()) ?? '';
      if (!actual.includes(config.text as string)) {
        throw new Error(
          `Assert failed: expected text "${config.text as string}" not found in (${label}).\n` +
            `  Actual: "${actual}"`,
        );
      }
    }

    if (config.value !== undefined) {
      const actual = await locator.inputValue();
      if (actual !== config.value) {
        throw new Error(
          `Assert failed: expected input value "${config.value as string}", ` +
            `got "${actual}" for (${label})`,
        );
      }
    }

    if (config.count !== undefined) {
      const actual = await locator.count();
      if (actual !== config.count) {
        throw new Error(
          `Assert failed: expected count ${config.count as number}, got ${actual} for (${label})`,
        );
      }
    }

    if (config.enabled === true) {
      const ok = await locator.isEnabled();
      if (!ok) throw new Error(`Assert failed: expected element (${label}) to be enabled`);
    } else if (config.enabled === false) {
      const ok = await locator.isEnabled();
      if (ok) throw new Error(`Assert failed: expected element (${label}) to be disabled`);
    }

    if (config.checked === true) {
      const ok = await locator.isChecked();
      if (!ok) throw new Error(`Assert failed: expected element (${label}) to be checked`);
    } else if (config.checked === false) {
      const ok = await locator.isChecked();
      if (ok) throw new Error(`Assert failed: expected element (${label}) to be unchecked`);
    }

    return ctx;
  }
}
