import type { NavigateStep, StepExecutor } from '../types/index.js';
import type { RuntimeContext } from '../types/execution-context.js';

export class NavigateExecutor implements StepExecutor<NavigateStep> {
  readonly type = 'navigate';

  async execute(step: NavigateStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const { url, waitUntil = 'load' } = step.navigate;
    await ctx.page.goto(url, { waitUntil });
    return ctx;
  }
}
