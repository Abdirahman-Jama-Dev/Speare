import type { A11yStep, StepExecutor, RuntimeContext } from '../types/index.js';

async function runAxe(ctx: RuntimeContext, config: A11yStep['a11y']): Promise<void> {
  const { AxeBuilder } = await import('@axe-core/playwright');
  let builder = new AxeBuilder({ page: ctx.page });

  if (config.include && config.include.length > 0) {
    for (const selector of config.include) {
      builder = builder.include(selector);
    }
  }

  if (config.exclude && config.exclude.length > 0) {
    for (const selector of config.exclude) {
      builder = builder.exclude(selector);
    }
  }

  const result = await builder.analyze();

  const violations = result.violations.filter((v) => {
    if (!config.severity || config.severity.length === 0) return true;
    return v.impact && config.severity.includes(v.impact as 'critical' | 'serious' | 'moderate' | 'minor');
  });

  if (violations.length > 0) {
    const summary = violations
      .map(
        (v) =>
          `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.description}\n` +
          v.nodes.map((n) => `    - ${n.html}`).join('\n'),
      )
      .join('\n');
    throw new Error(`Accessibility violations found (${violations.length}):\n${summary}`);
  }
}

export class A11yExecutor implements StepExecutor<A11yStep> {
  readonly type = 'a11y';

  async execute(step: A11yStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    if (!step.a11y.run) return ctx;
    await runAxe(ctx, step.a11y);
    return ctx;
  }
}
