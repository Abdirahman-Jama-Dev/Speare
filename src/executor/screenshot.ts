import * as fs from 'fs';
import * as path from 'path';
import type { ScreenshotStep, StepExecutor, RuntimeContext } from '../types/index.js';

export class ScreenshotExecutor implements StepExecutor<ScreenshotStep> {
  readonly type = 'screenshot';

  async execute(step: ScreenshotStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const config = ctx.resolveDeep(step.screenshot, -1, 'screenshot');
    const safeTestName = ctx.testName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = (config.name as string).replace(/[^a-zA-Z0-9_-]/g, '_');

    const baselineDir = path.join(
      ctx.projectRoot,
      ctx.config.visual?.baselineDir ?? 'visual_baselines',
    );
    const screenshotPath = path.join(baselineDir, `${safeTestName}_${safeName}.png`);

    if (!fs.existsSync(path.dirname(screenshotPath))) {
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    }

    const currentBuffer = await ctx.page.screenshot({
      fullPage: (config.fullPage as boolean | undefined) ?? false,
    });

    if (!fs.existsSync(screenshotPath)) {
      fs.writeFileSync(screenshotPath, currentBuffer);
      return ctx;
    }

    const baseline = fs.readFileSync(screenshotPath);
    const threshold = (config.threshold as number | undefined) ?? ctx.config.visual?.threshold ?? 0.01;
    const diff = compareScreenshots(baseline, currentBuffer);

    if (diff > threshold) {
      const failPath = screenshotPath.replace('.png', '.fail.png');
      fs.writeFileSync(failPath, currentBuffer);
      throw new Error(
        `Visual regression: "${config.name as string}" diff ${(diff * 100).toFixed(2)}% ` +
          `exceeds threshold ${(threshold * 100).toFixed(2)}%. Failing screenshot: ${failPath}`,
      );
    }

    return ctx;
  }
}

function compareScreenshots(baseline: Buffer, current: Buffer): number {
  if (baseline.length !== current.length) return 1;
  let diffBytes = 0;
  for (let i = 0; i < baseline.length; i++) {
    if (baseline[i] !== current[i]) diffBytes++;
  }
  return diffBytes / baseline.length;
}
