# Speare — Architecture & Internals

This document explains exactly how the framework works: every layer, every data flow, and every decision point. Read this before touching any source file.

---

## 1. The Big Picture

Speare is a **YAML-to-Playwright bridge**. The user writes tests in YAML; the framework translates those into Playwright `test()` calls at runtime. No test code is generated or written to disk — translation happens in memory every time tests run.

```
User's YAML files
       │
       ▼
  [CLI: speare run]          Parses args → RunConfig
       │
       ▼
  [Config Loader]            Reads .env + framework.config.yaml → FrameworkConfig
       │
       ▼
  [Playwright spawned]       CLI passes config via env vars to avoid flag conflicts
       │
       ▼
  [playwright-entry.ts]      Discovered YAML → test.describe() + test() blocks (in memory)
       │
       ▼
  [test-runner.ts]           Per-test orchestration: hooks → steps → hooks → cleanup
       │
       ▼
  [ExecutorRegistry]         Dispatches each step to its matching executor
       │
       ▼
  [Executors ×11]            Stateless handlers: UI, API, assert, mock, generate, screenshot,
                             a11y, measure, db, eval, navigate
       │
       ▼
  [RuntimeContext]           Immutable context that flows through every step,
                             accumulating `save:` outputs
```

---

## 2. Directory Layout

```
src/
├── cli/                  Entry point + subcommands (run, validate, merge-reports)
├── config/               Load .env + framework.config.yaml, resolve ENV.* refs
├── loader/               Parse + validate all YAML files; test discovery; suite expansion
├── schema/               AJV validator + 6 JSON schemas (one per YAML file type)
├── resolver/             4-layer variable resolution system (the core data engine)
├── executor/             11 step executors + registry + locator builder + DB connection
├── runner/               Test runner, suite runner, hook runner, retry logic
├── types/                All TypeScript interfaces (no logic, no imports from src/)
└── utils/                Logger, error formatting, masking, path resolution
```

---

## 3. Startup Sequence

### 3.1 Project Root Detection

The CLI (`src/cli/index.ts`) detects the project root in priority order:

1. `SPEARE_ROOT` environment variable (explicit override)
2. Current working directory, if it contains `framework.config.yaml`
3. Framework install directory (fallback when used as a dependency)

This means users can run `npm test` from their own project and Speare finds everything automatically.

### 3.2 Config Loading (`src/config/index.ts`)

Two things are loaded once at startup:

- **`.env`** → plain `Record<string, string>` (keys without the `ENV.` prefix)
- **`framework.config.yaml`** → parsed, validated against `framework-config.schema.json`, and returned as `FrameworkConfig`

`resolveEnvPlaceholders()` recursively walks the config and replaces any `ENV.KEY` strings with their actual values. This is what allows `baseUrl: "ENV.BASE_URL"` to work in the config file itself.

### 3.3 CLI → Playwright Handoff

The CLI **does not run tests itself**. It spawns `npx playwright test` via `spawnSync` and passes the run configuration through environment variables (`SPEARE_TAGS`, `SPEARE_SUITE`, `SPEARE_TEST_FILE`, etc.).

This design avoids flag conflicts — Playwright has its own CLI flags (`--shard`, `--workers`) that would clash if Speare tried to pass them directly. Instead Speare passes its own config as env vars, then reads them back inside the Playwright process.

### 3.4 Test Generation (`src/runner/playwright-entry.ts`)

This file is the boundary between the CLI world and the Playwright world. It is **picked up by `playwright.config.ts` via `testMatch`** — it is a test file, not a module. Playwright executes it at startup.

Inside it:

1. Reads run config from the `SPEARE_*` env vars set by the CLI
2. Discovers test YAML files (or resolves a suite)
3. Loads the page object registry (all `pages/*.yaml` files)
4. For each test definition, generates a `test.describe()` + `test()` block in memory
5. Tags are applied as `@tagname` suffixes in the describe title (Playwright's tag filter format)
6. Per-test retry count is applied via `test.describe.configure({ retries: n })`

---

## 4. The Execution Pipeline

### 4.1 Per-Test Orchestration (`src/runner/test-runner.ts`)

When Playwright runs a generated `test()`, it calls `runTest(params)`. This function:

```
1. Create DatabaseConnection (if configured) — not connected yet
2. Build initial RuntimeContext from role data + test variables + .env
3. Connect database (BEGIN TRANSACTION if isolationMode: transaction)
4. runHook('beforeAll')   → accumulates ctx
5. runHook('beforeEach')  → accumulates ctx
6. runSteps(steps)        → accumulates ctx  ← the main test
7. [always] runHook('afterEach')
8. [always] runHook('afterAll')
9. [always] database.teardown() — ROLLBACK if in transaction
10. [always] page.unrouteAll()  — clear any network mocks
```

Steps 7–10 run in `finally` blocks so they execute even if the test fails. Hook failures are logged as warnings rather than re-thrown, so a broken cleanup hook doesn't obscure the original test failure.

**Important:** All four phases (beforeAll, beforeEach, steps, afterEach/afterAll) share the same `ctx` variable. Each phase returns an updated context that the next phase receives. This means a `save:` in a `beforeAll` API step is available to every subsequent step in the test, and a `save:` in a main step is available to cleanup hooks.

### 4.2 Step Execution with Retry (`src/runner/retry.ts`)

`runSteps()` iterates the step array, passing the accumulated context forward:

```typescript
for (const step of steps) {
  ctx = await executeWithRetry(step, ctx, registry, { maxAttempts, delayMs, ... });
}
```

`executeWithRetry()` wraps a single dispatch attempt in a loop. On failure, it waits `retryDelay` ms (default 1000ms, overridable per-step via `retryDelay:`) and retries up to `retry:` additional times. The last error is re-thrown if all attempts fail.

The context returned by each step becomes the input to the next. This is how `save:` outputs propagate — they are encoded in the returned `RuntimeContext`, not stored in a side-effectful global.

### 4.3 Executor Registry (`src/executor/registry.ts`)

The `ExecutorRegistry` is a `Map<string, StepExecutor>`. Step type detection works by comparing the step's top-level YAML keys against the registered executor names:

```typescript
detectType(step): string {
  for (const key of Object.keys(step)) {
    if (this.executors.has(key)) return key;
  }
  throw new Error(`Unknown step type...`);
}
```

So the step `{ api: {...} }` is matched to the `ApiExecutor` (whose `type === 'api'`). This means new step types cost exactly two things: write a class with `type = 'myType'`, and call `registry.register(new MyExecutor())`. Nothing else changes.

### 4.4 Executors

All 11 executors are **stateless**. They receive a `RuntimeContext` (which contains the Playwright page/apiContext/db handles), perform their work, and return either the same context or a new one (when they call `ctx.save()`).

| Executor | Does | Returns |
|---|---|---|
| `NavigateExecutor` | `page.goto(url, { waitUntil })` | same ctx |
| `UiExecutor` | Navigate if needed, run page object actions | same ctx |
| `ApiExecutor` | HTTP request via `apiContext`, assert status/jsonPath, save values | new ctx if save: |
| `AssertExecutor` | Playwright locator assertions (visible, text, value, count, enabled, checked) | same ctx |
| `MockExecutor` | `page.route()` for network interception | same ctx |
| `GenerateExecutor` | `faker.*` and `uuid` → save into ctx | new ctx |
| `ScreenshotExecutor` | Capture or compare screenshot, fail on pixel diff | same ctx |
| `A11yExecutor` | Axe scan, fail on severity violations | same ctx |
| `MeasureExecutor` | Collect Web Performance metrics, assert thresholds, save values | new ctx if metrics saved |
| `DbExecutor` | SQL query via `dbConnection`, assert rows/column, save values | new ctx if save: |
| `EvalExecutor` | Run user JS in a locked-down `vm.Context` (behind `allowEval` flag) | new ctx if output: |

---

## 5. The Resolution System

This is the most important subsystem. Every string value in every YAML file passes through it before being used.

### 5.1 The Four Layers

Resolution happens in strict priority order — **higher layers win**:

```
Layer 4 (highest): Step outputs        — accumulated save: values from previous steps
Layer 3:           Test variables      — variables: block in the test YAML
Layer 2:           Test data           — role data + data: imports (merged, ENV.* pre-resolved)
Layer 1 (lowest):  ENV                 — values from .env
```

### 5.2 Two Syntaxes

```
ENV.KEYNAME        — resolves from Layer 1 (env). Can appear inline in strings.
                     The resolved value is wrapped in MaskedValue for safe logging.

{variableName}     — resolves from Layers 4→3→2 (stepOutputs → testData → env).
                     Can appear inline in strings.
```

### 5.3 Resolution Mechanics (`src/resolver/placeholder-resolver.ts`)

`interpolateString(input, layers, stepIndex, stepType)` has three fast paths:

1. **Bare `ENV.KEY`** (entire string) → look up in env, return `MaskedValue`
2. **Bare `{key}`** (entire string) → look up across all layers, return raw value (may be non-string)
3. **Exact key match** → if the whole string equals a known key in any layer, return that value

If none of those match, it does composite interpolation: replace all `ENV.KEY` and `{key}` patterns inside the string, producing a new string. Composite strings always return strings (cannot return non-string values like objects or numbers).

`resolveDeep(value, layers, ...)` recursively walks any value (string, array, plain object) and runs `interpolateString` on every string leaf. This is how full API request bodies and headers get resolved in one call.

### 5.4 Initialization Order

At test start, `buildRuntimeContext()` pre-resolves `ENV.*` references in role data and data imports:

```
role data: { username: "ENV.ADMIN_USERNAME" }
               ↓  resolveEnvPlaceholders()
           { username: "admin@company.com" }
```

This means `{username}` in a step works without knowing that the original value was an env reference. The resolution chain is: `{username}` → looks up layer 2 → finds `"admin@company.com"`. There is no double-resolution needed.

### 5.5 Unresolved Placeholder Errors

When a key is not found in any layer, `formatUnresolvedPlaceholderError()` fires and produces a message like:

```
Error: Unresolved placeholder "userId" in step 3 (api).
  Not found in:
    - step outputs:    [sessionId, fakeEmail]
    - test variables:  [expectedTotal]
    - ENV.*:           [BASE_URL, API_BASE_URL, ADMIN_USERNAME]
  Did you mean: "sessionId"?
```

The "Did you mean?" suggestions use Levenshtein distance (max 3 edits, top 3 matches) implemented in `src/utils/error-formatting.ts`.

---

## 6. YAML Loading & Validation

### 6.1 Parse Pipeline (`src/loader/index.ts`)

Every YAML file goes through:

```
fs.readFileSync → js-yaml.load() → AJV validate() → typed return value
```

`validate(filePath, schemaName, rawData)` in `src/schema/index.ts` runs AJV against one of six schemas. If validation fails, it throws a detailed error listing every schema violation (AJV's `errorsText` output) plus the file path.

### 6.2 The Six Schemas

| File Type | Schema | Key Constraints |
|---|---|---|
| `framework.config.yaml` | `framework-config.schema.json` | Enum drivers, valid isolation modes |
| `pages/*.yaml` | `page-object.schema.json` | Action enum: fill/click/select/check/uncheck/hover/press/clear, selector type enum |
| `tests/*.yaml` | `test-definition.schema.json` | Most complex — validates all 11 step shapes as a union |
| `data/roles/*.yaml` | `role-data.schema.json` | Free-form string map |
| `mocks/*.yaml` | `mock.schema.json` | Required url + response |
| `suites/*.yaml` | `suite.schema.json` | Test entry as string or { path, order } |

### 6.3 Test Discovery

`discoverTests()` scans `tests/` recursively for `.yaml` files, loads each, then applies tag filters. The `--tag` flag is inclusive (OR logic — a test passes if it has at least one of the specified tags). The `--exclude` flag is exclusive (OR logic — a test is dropped if it has any excluded tag).

For suite runs, `resolveSuiteTests()` loads the suite YAML, resolves each test path, and sorts by `order:`. Matrix suites expand to multiple `{ matrixEnv, tests }` runs via `expandMatrixSuite()`.

---

## 7. The RuntimeContext Object

`RuntimeContext` is the single object that flows through every part of the execution pipeline. It carries:

- **`config`** — `FrameworkConfig` (baseUrl, timeout, database settings, etc.)
- **`resolution`** — snapshot of all three data layers (env, testData, stepOutputs)
- **`layers`** — same data in `ResolutionLayers` shape (used by the resolver)
- **`page`** — Playwright `Page` handle
- **`browserContext`** — Playwright `BrowserContext`
- **`apiContext`** — Playwright `APIRequestContext`
- **`pageObjects`** — `Map<name, PageObjectDefinition>` (all pages/ loaded at startup)
- **`projectRoot`** — absolute path (used by screenshot and eval executors to resolve file paths)
- **`testName`** — for logging
- **`dbConnection`** — `DbQueryRunner | null`

**`save(key, value): RuntimeContext`** is the only mutation point. It returns a new `ConcreteRuntimeContext` instance with an updated `stepOutputs` map. The original is never modified. This is what makes the pipeline safe to retry — a failed step's partial saves are discarded because the returned context is never propagated on failure.

---

## 8. Database Layer

`DatabaseConnection` (`src/executor/db-connection.ts`) wraps four drivers behind one `DbDriver` interface:

```typescript
interface DbDriver {
  query(sql: string, timeout: number): Promise<DbRow[]>;
  beginTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  close(): Promise<void>;
}
```

The `DatabaseConnection` class implements `DbQueryRunner` (used externally):

```typescript
interface DbQueryRunner {
  query(sql: string): Promise<DbRow[]>;
  teardown(): Promise<void>;
}
```

Connection and transaction lifecycle:
1. `connect()` — called once at the start of each test (lazy: no-ops if already connected)
2. If `isolationMode: transaction` → `driver.beginTransaction()` immediately after connect
3. All `db:` steps call `connection.query(sql)` which enforces readonly guard if `isolationMode: readonly`
4. `teardown()` — called in `finally` block: rolls back transaction if active, then closes

**MSSQL isolation** uses `new mssql.Transaction(pool)` so all queries in a test share a single connection. Prior to the fix, each `pool.request()` could draw a different connection from the pool, making `BEGIN`/`ROLLBACK` operate on different sessions.

---

## 9. Secret Masking

Any value resolved from the `env` layer is wrapped in a `MaskedValue` object:

```typescript
interface MaskedValue { readonly __masked: true; readonly value: string; }
```

The logger and dry-run output use `████████` in place of the actual value when it detects `__masked: true`. This prevents secrets from appearing in test logs or CI output. When a masked value is used in a composite string (e.g., `ENV.BASE_URL/api`), the raw value is interpolated normally — masking only applies to standalone values in log output.

---

## 10. The Dry-Run Mode

`speare run --dry-run` runs the resolution system without launching Playwright. It:

1. Loads config + env
2. Loads each test's role data + variables
3. Resolves all layer values
4. Prints a table of every resolved variable: name, display value (masked if secret), and source layer

This is the primary debugging tool when `{variableName}` resolution behaves unexpectedly.

---

## 11. Sharding & Parallelism

Sharding is delegated entirely to Playwright. `--shard=1/4` is passed directly as `--shard=1/4` in the `playwrightArgs` array when spawning Playwright. Playwright splits the discovered `test.describe()` blocks across shards.

`--workers` sets `SPEARE_WORKERS` env var, which `playwright.config.ts` reads to configure `workers:`. Sharded runs produce separate JSON report artifacts in `reports/json/`. The `merge-reports` command merges those artifacts into a single report.

---

## 12. Key Invariants

These are the properties the system depends on. Breaking any of them is a bug:

1. **Executors are stateless.** All state lives in `RuntimeContext`. An executor must not store anything between `execute()` calls.
2. **`save()` is the only mutation.** Nothing else may modify the resolution layers.
3. **`runSteps` return value must be captured.** Discarding it (e.g. `await runSteps(...)` without `ctx =`) means cleanup hooks lose all `save:` outputs from the test. See `test-runner.ts:72`.
4. **Schema validation runs before execution.** A test definition that passes schema validation should never crash with a "missing field" error in an executor.
5. **Playwright handles are never stored in module-level variables.** They come in via `RuntimeContext` per-test, which is what makes parallel execution safe.
