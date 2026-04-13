import { JSONPath } from 'jsonpath-plus';
import type { DbStep, StepExecutor, RuntimeContext } from '../types/index.js';

function assertDbResult(rows: Array<Record<string, unknown>>, config: DbStep['db']): void {
  if (!config.assert) return;

  if (config.assert.rowCount !== undefined && rows.length !== config.assert.rowCount) {
    throw new Error(
      `DB assertion failed: expected ${config.assert.rowCount} row(s), got ${rows.length}`,
    );
  }

  if (config.assert.column !== undefined && config.assert.equals !== undefined) {
    const firstRow = rows[0];
    if (!firstRow) throw new Error(`DB assertion failed: no rows returned for column assertion`);
    const actual = firstRow[config.assert.column];
    if (JSON.stringify(actual) !== JSON.stringify(config.assert.equals)) {
      throw new Error(
        `DB assertion failed: column "${config.assert.column}" ` +
          `expected ${JSON.stringify(config.assert.equals)}, got ${JSON.stringify(actual)}`,
      );
    }
  }
}

export class DbExecutor implements StepExecutor<DbStep> {
  readonly type = 'db';

  async execute(step: DbStep, ctx: RuntimeContext): Promise<RuntimeContext> {
    if (!ctx.dbConnection) {
      throw new Error(
        `db: step requires a database connection. ` +
          `Configure "database:" in framework.config.yaml.`,
      );
    }

    const config = ctx.resolveDeep(step.db, -1, 'db');
    const rows = await ctx.dbConnection.query(config.query as string);

    assertDbResult(rows, config as DbStep['db']);

    let updatedCtx: RuntimeContext = ctx;
    const saveConfig = (config as DbStep['db']).save ?? {};
    for (const [key, path] of Object.entries(saveConfig)) {
      const value = JSONPath({ path, json: rows as object, wrap: false });
      updatedCtx = updatedCtx.save(key, value);
    }

    return updatedCtx;
  }
}
