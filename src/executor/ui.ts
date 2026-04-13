import type { RuntimeContext, UiStep, StepExecutor } from '../types/index.js';
import { buildLocatorFromDefinition } from './locator-builder.js';

export class UiExecutor implements StepExecutor<UiStep> {
  readonly type = 'ui';

  async execute(step: UiStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const { pageObject: pageObjectName, action: actionName, args = {} } = step.ui;

    const po = ctx.pageObjects.get(pageObjectName);
    if (!po) {
      throw new Error(
        `Page object "${pageObjectName}" not found. ` +
          `Available: [${[...ctx.pageObjects.keys()].join(', ')}]`,
      );
    }

    const action = po.actions[actionName];
    if (!action) {
      throw new Error(
        `Action "${actionName}" not found on page object "${pageObjectName}". ` +
          `Available: [${Object.keys(po.actions).join(', ')}]`,
      );
    }

    if (po.url) {
      const baseUrl = ctx.config.baseUrl ?? '';
      const resolvedUrl = ctx.resolveDeep(po.url, -1, 'ui.navigate') as string;
      const fullUrl = resolvedUrl.startsWith('http') ? resolvedUrl : `${baseUrl}${resolvedUrl}`;
      await ctx.page.goto(fullUrl);
    }

    for (const actionStep of action) {
      const selectorDef = po.selectors[actionStep.selector];
      if (!selectorDef) {
        throw new Error(
          `Selector "${actionStep.selector}" not found in page object "${pageObjectName}". ` +
            `Available selectors: [${Object.keys(po.selectors).join(', ')}]`,
        );
      }

      const locator = buildLocatorFromDefinition(ctx.page, selectorDef);
      const rawValue = args[actionStep.selector] ?? actionStep.value ?? '';
      const resolvedValue = ctx.resolveDeep(rawValue, -1, `ui.${actionName}`) as string;

      switch (actionStep.action) {
        case 'fill':    await locator.fill(resolvedValue); break;
        case 'click':   await locator.click(); break;
        case 'select':  await locator.selectOption(resolvedValue); break;
        case 'check':   await locator.check(); break;
        case 'uncheck': await locator.uncheck(); break;
        case 'hover':   await locator.hover(); break;
        case 'press':   await locator.press(resolvedValue); break;
        default: {
          const _exhaustive: never = actionStep.action;
          throw new Error(`Unsupported action: "${String(_exhaustive)}"`);
        }
      }
    }

    return ctx;
  }
}
