import { JSONPath } from 'jsonpath-plus';
import { isMaskedValue } from '../types/masked-value.js';
import type { ApiStep, ApiStepConfig, StepExecutor, RuntimeContext } from '../types/index.js';

function extractJsonPath(body: unknown, path: string): unknown {
  return JSONPath({ path, json: body as object, wrap: false });
}

function assertApiResponse(config: ApiStepConfig, status: number, body: unknown): void {
  if (config.assert?.status !== undefined && status !== config.assert.status) {
    throw new Error(
      `API assertion failed: expected status ${config.assert.status}, got ${status}`,
    );
  }
  if (config.assert?.jsonPath) {
    const extracted = extractJsonPath(body, config.assert.jsonPath);
    const expected = config.assert.equals;
    if (JSON.stringify(extracted) !== JSON.stringify(expected)) {
      throw new Error(
        `API assertion failed: jsonPath "${config.assert.jsonPath}" ` +
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(extracted)}`,
      );
    }
  }
}

export class ApiExecutor implements StepExecutor<ApiStep> {
  readonly type = 'api';

  async execute(step: ApiStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    const config = ctx.resolveDeep(step.api, -1, 'api') as ApiStepConfig;

    const headers = config.headers
      ? Object.fromEntries(
          Object.entries(config.headers).map(([k, v]) => [
            k,
            isMaskedValue(v) ? v.value : String(v),
          ]),
        )
      : undefined;

    const method = config.method.toLowerCase() as Lowercase<typeof config.method>;
    const response = await ctx.apiContext[method](config.url, {
      ...(headers ? { headers } : {}),
      data: config.body ?? undefined,
    });

    const status = response.status();
    const body: unknown = await response.json().catch(() => null);

    assertApiResponse(config, status, body);

    let updatedCtx: RuntimeContext = ctx;
    if (config.save && body !== null) {
      for (const [key, path] of Object.entries(config.save)) {
        const value = extractJsonPath(body, path);
        updatedCtx = updatedCtx.save(key, value);
      }
    }

    return updatedCtx;
  }
}
