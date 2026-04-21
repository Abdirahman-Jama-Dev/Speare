import type { NavigateStep, StepExecutor } from '../types/index.js';
import type { RuntimeContext } from '../types/execution-context.js';

export class NavigateExecutor implements StepExecutor<NavigateStep> {
  readonly type = 'navigate';

  async execute(step: NavigateStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const { url, waitUntil = 'load' } = step.navigate;
    const resolvedUrl = ctx.resolveDeep(url, -1, 'navigate') as string;
    const baseUrl = ctx.config.baseUrl ?? '';
    const fullUrl = resolvedUrl.startsWith('http') ? resolvedUrl : `${baseUrl}${resolvedUrl}`;
    await ctx.page.goto(fullUrl, { waitUntil });
    return ctx;
  }
}
