// ─── Re-export all executor classes for consumers ─────────────────────────────
// Import first so they can also be used in buildDefaultRegistry below.

import { ExecutorRegistry } from './registry.js';
import { UiExecutor } from './ui.js';
import { ApiExecutor } from './api.js';
import { AssertExecutor } from './assert.js';
import { MockExecutor } from './mock.js';
import { GenerateExecutor } from './generate.js';
import { ScreenshotExecutor } from './screenshot.js';
import { A11yExecutor } from './a11y.js';
import { MeasureExecutor } from './measure.js';
import { DatabaseConnection } from './db-connection.js';
import { DbExecutor } from './db.js';
import { EvalExecutor } from './eval.js';
import { NavigateExecutor } from './navigate.js';
import { buildLocatorFromDefinition } from './locator-builder.js';

export {
  ExecutorRegistry,
  UiExecutor,
  ApiExecutor,
  AssertExecutor,
  MockExecutor,
  GenerateExecutor,
  ScreenshotExecutor,
  A11yExecutor,
  MeasureExecutor,
  DatabaseConnection,
  DbExecutor,
  EvalExecutor,
  NavigateExecutor,
  buildLocatorFromDefinition,
};

// ─── Default Registry ─────────────────────────────────────────────────────────
//
// All executors are stateless — Playwright handles are sourced from RuntimeContext.
// A new registry is created per test for isolation.

export function buildDefaultRegistry(): ExecutorRegistry {
  const r = new ExecutorRegistry();
  r.register(new UiExecutor());
  r.register(new ApiExecutor());
  r.register(new AssertExecutor());
  r.register(new MockExecutor());
  r.register(new GenerateExecutor());
  r.register(new ScreenshotExecutor());
  r.register(new A11yExecutor());
  r.register(new MeasureExecutor());
  r.register(new DbExecutor());
  r.register(new EvalExecutor());
  r.register(new NavigateExecutor());
  return r;
}
