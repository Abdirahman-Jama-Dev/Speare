import * as path from 'path';
import { loadMockDefinition } from '../loader/index.js';
import type { MockStep, MockDefinition, StepExecutor, RuntimeContext } from '../types/index.js';

export class MockExecutor implements StepExecutor<MockStep> {
  readonly type = 'mock';

  async execute(step: MockStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const mockConfig = step.mock;

    let definition: MockDefinition;
    if (typeof mockConfig === 'string') {
      const filePath = path.resolve(ctx.projectRoot, mockConfig);
      definition = loadMockDefinition(filePath);
    } else {
      definition = mockConfig;
    }

    const resolvedDef = ctx.resolveDeep(definition, -1, 'mock') as MockDefinition;

    await ctx.page.route(resolvedDef.url, async (route) => {
      if (resolvedDef.method && route.request().method() !== resolvedDef.method) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: resolvedDef.response.status,
        contentType: 'application/json',
        headers: resolvedDef.response.headers,
        body: resolvedDef.response.body !== undefined
          ? JSON.stringify(resolvedDef.response.body)
          : undefined,
      });
    });

    return ctx;
  }
}
