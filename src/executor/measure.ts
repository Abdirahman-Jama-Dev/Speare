import type { MeasureStep, MeasureThresholds, MetricName, StepExecutor, RuntimeContext } from '../types/index.js';

interface PerformanceTimingEntry { loadEventEnd: number; navigationStart: number; }
interface LargestContentfulPaint { startTime: number; }
interface LayoutShiftEntry { hadRecentInput: boolean; value: number; }

async function collectMetrics(ctx: RuntimeContext, metrics: readonly MetricName[]): Promise<Partial<MeasureThresholds>> {
  const result: Partial<Record<MetricName, number>> = {};

  const timing = await ctx.page.evaluate<PerformanceTimingEntry>(() => {
    const t = (performance as any).timing;
    return { loadEventEnd: t.loadEventEnd, navigationStart: t.navigationStart };
  });

  if (metrics.includes('loadTime')) {
    result.loadTime = timing.loadEventEnd - timing.navigationStart;
  }

  if (metrics.includes('largestContentfulPaint')) {
    result.largestContentfulPaint = await ctx.page.evaluate<number>(() =>
      new Promise<number>((resolve) => {
        let lcp = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries() as LargestContentfulPaint[];
          const last = entries[entries.length - 1];
          if (last) lcp = last.startTime;
        });
        observer.observe({ type: 'largest-contentful-paint' as any, buffered: true });
        setTimeout(() => resolve(lcp), 100);
      })
    );
  }

  if (metrics.includes('cumulativeLayoutShift')) {
    result.cumulativeLayoutShift = await ctx.page.evaluate<number>(() =>
      new Promise<number>((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) cls += entry.value;
          }
        });
        observer.observe({ type: 'layout-shift' as any, buffered: true });
        setTimeout(() => resolve(cls), 100);
      })
    );
  }

  if (metrics.includes('firstContentfulPaint')) {
    result.firstContentfulPaint = await ctx.page.evaluate<number>(() => {
      const entries = performance.getEntriesByName('first-contentful-paint');
      const entry = entries[0];
      return entry ? entry.startTime : 0;
    });
  }

  return result;
}

export class MeasureExecutor implements StepExecutor<MeasureStep> {
  readonly type = 'measure';

  async execute(step: MeasureStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const config = ctx.resolveDeep(step.measure, -1, 'measure');
    const collected = await collectMetrics(ctx, config.metrics as readonly MetricName[]);

    const failures: string[] = [];
    if (config.thresholds) {
      for (const [metric, threshold] of Object.entries(config.thresholds) as Array<[MetricName, number]>) {
        const actual = collected[metric];
        if (actual !== undefined && actual > threshold) {
          failures.push(`  ${metric}: ${actual.toFixed(2)} exceeds threshold ${threshold}`);
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Performance thresholds exceeded for "${config.label as string}":\n` + failures.join('\n'),
      );
    }

    let updatedCtx: RuntimeContext = ctx;
    for (const [metric, value] of Object.entries(collected)) {
      updatedCtx = updatedCtx.save(`${config.label as string}.${metric}`, value);
    }
    return updatedCtx;
  }
}
