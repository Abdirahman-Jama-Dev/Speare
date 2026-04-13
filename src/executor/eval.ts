import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import type { EvalStep, StepExecutor, RuntimeContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

function buildSandbox(input: Record<string, unknown>, ctx: RuntimeContext): vm.Context {
  const sandbox = Object.create(null) as Record<string, unknown>;
  sandbox['input'] = input;
  sandbox['page'] = ctx.page;
  sandbox['Promise'] = Promise;
  sandbox['require'] = undefined;
  sandbox['process'] = undefined;
  sandbox['globalThis'] = undefined;
  sandbox['global'] = undefined;
  return vm.createContext(sandbox);
}

export class EvalExecutor implements StepExecutor<EvalStep> {
  readonly type = 'eval';

  async execute(step: EvalStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    if (!ctx.config.security?.allowEval) {
      throw new Error(
        `eval: step is disabled. Set "security.allowEval: true" in framework.config.yaml.\n` +
          `Script: "${step.eval.script}"`,
      );
    }

    const scriptPath = path.resolve(ctx.projectRoot, step.eval.script);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`eval: script not found: "${scriptPath}"`);
    }

    logger.info(`eval: executing script`, { script: step.eval.script });

    const scriptSource = fs.readFileSync(scriptPath, 'utf-8');
    const rawInput = step.eval.input ?? {};
    const resolvedInput = ctx.resolveDeep(rawInput, -1, 'eval') as Record<string, unknown>;

    const sandbox = buildSandbox(resolvedInput, ctx);
    const wrapped = `(async () => { ${scriptSource} })()`;
    const script = new vm.Script(wrapped, { filename: scriptPath });
    const result: unknown = await script.runInContext(sandbox) as unknown;

    let updatedCtx: RuntimeContext = ctx;
    if (step.eval.output) {
      updatedCtx = updatedCtx.save(step.eval.output, result);
    }
    return updatedCtx;
  }
}
