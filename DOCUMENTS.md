# Speare Codebase Documentation

Complete walkthrough of the Speare framework architecture, modules, and design patterns.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Module Overview](#module-overview)
3. [Core Design Patterns](#core-design-patterns)
4. [Execution Flow](#execution-flow)
5. [Detailed Module Reference](#detailed-module-reference)
6. [Extending the Framework](#extending-the-framework)
7. [Testing Infrastructure](#testing-infrastructure)

---

## Project Structure

```
src/
├── cli/                    # CLI entry point and commands
├── config/                 # Configuration loading (framework.config.yaml, .env)
├── executor/               # Step executors (ui, api, db, assert, screenshot, a11y, measure, eval, generate, mock)
├── loader/                 # YAML file loading and schema validation
├── resolver/               # Variable resolution (3-layer placeholder system)
├── runner/                 # Test execution engine (retry logic, hooks, suite runner)
├── schema/                 # JSON schemas for YAML validation
├── types/                  # TypeScript type definitions
└── utils/                  # Utilities (error formatting, masking, logging)

tests/                      # Example YAML tests
pages/                      # Page Object definitions (YAML)
data/
└── roles/                  # Role-based test data (YAML)
suites/                     # Test suites with ordering/config (YAML)
mocks/                      # Mock responses (YAML)
visual_baselines/           # Screenshot baselines
reports/                    # Generated test reports
```

---

## Module Overview

### 1. CLI (`src/cli/`)

**Files:**
- `index.ts` — Main CLI entry point using Commander.js
- `dry-run.ts` — `--dry-run` command: preview resolved variables
- `validate.ts` — `validate` command: check all YAML files
- `merge-reports.ts` — `merge-reports` command: combine sharded results

**Key Features:**
- Subcommands: `run` (default), `validate`, `merge-reports`
- Options: `--tag`, `--exclude`, `--suite`, `--test`, `--dry-run`, `--shard`, `--workers`, `--reporter`
- Spawns Playwright test runner via `spawnSync()`
- Config collected into `RunConfig` type

**How it works:**
1. Parse CLI arguments with Commander
2. Build `RunConfig` object
3. If `--dry-run`, call `runDryRun()` and exit
4. Otherwise, spawn Playwright runner process with env vars

---

### 2. Config (`src/config/`)

**Files:**
- `index.ts` — Load framework config and environment variables

**Key Functions:**
- `loadFrameworkConfig(projectRoot: string)` — Read and validate `framework.config.yaml`
- `loadEnv(projectRoot: string)` — Read `.env` file, return `Record<string, string>`

**What it loads:**
```typescript
interface FrameworkConfig {
  baseUrl?: string
  apiBaseUrl?: string
  retries?: number
  timeout?: number
  parallel?: { workers?: number; shard?: boolean; shardCount?: number }
  database?: { driver, connectionString, ssl?, queryTimeout?, isolationMode }
  visual?: { threshold, baselineDir }
  reporters?: string[]
  security?: { allowEval?, auditEvalSteps? }
}
```

**Features:**
- Validates against `framework-config.schema.json`
- Resolves environment variable references (e.g., `ENV.DB_URL`)
- Throws on validation errors with helpful messages

---

### 3. Loader (`src/loader/`)

**Files:**
- `index.ts` — Load YAML files: tests, pages, roles, suites, mocks

**Key Functions:**

| Function | Returns | Purpose |
|----------|---------|---------|
| `loadTestDefinition(path)` | `TestDefinition` | Parse test YAML |
| `loadPageObjectDefinition(name)` | `PageObject` | Parse page object YAML |
| `loadRoleData(name)` | `Record<string, unknown>` | Parse role YAML |
| `loadSuiteDefinition(name)` | `Suite` | Parse suite YAML |
| `loadMockDefinition(path)` | `MockDefinition` | Parse mock YAML |
| `resolveSuiteTests(suite)` | `TestDefinition[]` | Expand suite tests (matrix) |

**Validation:**
- Uses `ajv` (JSON Schema validator)
- Schemas in `src/schema/schemas/`
- Returns validated objects or throws with line numbers

**Interesting logic:**
- Matrix expansion: `matrix: { env: [staging, prod] }` → runs tests twice
- Suite ordering: Tests have explicit `order` property
- Config overrides: Per-suite `config` section overrides globals

---

### 4. Resolver (`src/resolver/`)

**Files:**
- `placeholder-resolver.ts` — Core resolution logic
- `resolution-context.ts` — Immutable context during load-time
- `runtime-context.ts` — Mutable context during execution with Playwright
- `dry-run.ts` — Format variable resolution for display
- Index exports

**Three-Layer Variable Resolution**

Layer 1: Step outputs (highest priority)
```typescript
interface StepOutput { [key: string]: unknown }
```

Layer 2: Test data (merged in order)
- Role data (from `data/roles/admin.yaml`)
- Data imports (from test's `data:` field)
- Test variables (from test's `variables:` field)

Layer 3: Environment variables (lowest priority)
```typescript
// Loaded from .env, wrapped in MaskedValue for safe logging
interface EnvVars { [key: string]: MaskedValue }
```

**Key Functions:**

```typescript
// Core resolver
function interpolateString(
  template: string,
  env: Record<string, any>,
  testData: Record<string, any>,
  stepOutputs: Record<string, any>
): string

// Deep resolution
function resolveDeep(
  value: unknown,
  ...sources
): unknown

// Lookup with error handling
function lookup(key: string, sources): unknown | UnresolvedPlaceholderError
```

**Error Handling:**
- `UnresolvedPlaceholderError` thrown if placeholder not found
- Error message includes:
  - Placeholder name
  - Step index and type
  - Available keys in each layer
  - "Did you mean?" suggestions (Levenshtein distance)

**Dry-run Output:**
```
[variables resolved]

  username       →  "alice"               (source: test variables)
  password       →  ████████              (source: ENV (masked))
  orderId        →  (resolved at runtime) (source: step outputs)
```

---

### 5. Runner (`src/runner/`)

**Files:**
- `test-runner.ts` — Main test execution loop
- `suite-runner.ts` — Suite-level execution
- `retry.ts` — Retry logic
- `hooks.ts` — Hook execution (beforeAll, afterEach, etc.)
- `playwright-entry.ts` — Playwright's test worker entry point

**Execution Flow:**

1. **CLI spawns Playwright** with `npm test`
2. **Playwright discovers** tests via `tests/**/*.yaml` glob
3. **For each test:**
   - Load test definition + page objects + role data
   - Resolve all variables (3-layer)
   - Run `beforeAll` hooks
   - Execute steps in sequence
   - Run `afterEach` hooks on each step
   - Capture artifacts (screenshot, DOM) on failure
4. **Report** collected via JSON/HTML/JUnit reporters

**Key Types:**

```typescript
interface ExecutionContext {
  page: Page
  config: FrameworkConfig
  testData: Record<string, unknown>
  stepOutputs: Record<string, unknown>
  dbConnection?: DatabaseConnection
  save(key: string, value: unknown): ExecutionContext
}

interface Step {
  ui?: UiStep
  api?: ApiStep
  db?: DbStep
  assert?: AssertStep
  // ... etc
}
```

**Retry Logic** (`retry.ts`):
- Test-level retries: `retry: 2` in test definition
- Step-level retries: `retry: 3` in individual steps
- Retries increment backoff delay between attempts
- Failure logged with attempt count

**Hooks** (`hooks.ts`):
- `beforeAll` — Once before all test steps
- `beforeEach` — Before each step
- `afterEach` — After each step (even on failure)
- `afterAll` — Once after all steps

---

### 6. Executor (`src/executor/`)

**Files:**
- `index.ts` — Executor registry (dispatcher)
- `ui.ts` — UI step execution (click, fill, navigate)
- `api.ts` — API step execution (fetch, assertions)
- `db.ts` — Database step execution (queries, assertions)
- `assert.ts` — Assertion step (selector checks)
- `screenshot.ts` — Screenshot capture + visual regression
- `a11y.ts` — Accessibility checks (axe-core)
- `measure.ts` — Performance metrics collection
- `generate.ts` — Data generation (uuid, faker)
- `eval.ts` — Sandboxed JavaScript execution
- `mock.ts` — Network mock interception
- `locator-builder.ts` — Build Playwright locators from YAML selectors
- `db-connection.ts` — Database connection management
- `registry.ts` — Type definitions for executor interface

**Executor Interface:**

```typescript
interface ExecutionFunction {
  (step: StepDefinition, context: ExecutionContext): Promise<ExecutionContext>
}

const executors: Record<string, ExecutionFunction> = {
  ui: executeUiStep,
  api: executeApiStep,
  db: executeDbStep,
  // ... etc
}
```

**Dispatcher** (`index.ts`):
```typescript
export async function executeStep(
  step: Step,
  context: ExecutionContext
): Promise<ExecutionContext> {
  const stepType = Object.keys(step)[0]
  const executor = executors[stepType]
  if (!executor) throw new Error(`Unknown step type: ${stepType}`)
  return executor(step, context)
}
```

#### UI Executor (`ui.ts`)

Handles Playwright interactions via page objects.

```yaml
- ui:
    pageObject: LoginPage
    action: login
    args:
      password: customPassword
```

**Flow:**
1. Load page object definition (LoginPage.yaml)
2. Resolve action (login → list of sub-actions)
3. For each sub-action (fill, click):
   - Build locator using `locator-builder.ts`
   - Perform action with templated values
4. Save step outputs if configured

**Selectors** (via `locator-builder.ts`):
```typescript
type SelectorType = "role" | "text" | "label" | "placeholder" | "testId" | "alt" | "title"

// Maps to Playwright locators:
page.getByRole(value, options)
page.getByText(value, options)
page.getByLabel(value)
page.getByPlaceholder(value)
page.getByTestId(value)
page.getByAltText(value)
page.getByTitle(value)
```

#### API Executor (`api.ts`)

Handles HTTP requests and response assertions.

```yaml
- api:
    method: GET
    url: "ENV.API_BASE_URL/users"
    body: { email: "test@example.com" }
    assert:
      status: 200
      jsonPath: "$.users[0].id"
      equals: 123
    save:
      userId: "$.users[0].id"
      emails: "$..email"
```

**Features:**
- Template resolution in URL and body
- Automatic Content-Type detection
- JSONPath assertions (jsonpath-plus)
- Result extraction and saving
- Auth header support
- Timeout handling

#### DB Executor (`db.ts` + `db-connection.ts`)

Handles SQL queries with driver abstraction.

**Connection Lifecycle:**
```typescript
class DatabaseConnection {
  constructor(config: DatabaseConfig)
  async connect(): Promise<void>
  async query(sql: string): Promise<DbRow[]>
  async teardown(): Promise<void>
  assertReadonly(sql: string): void
}
```

**Drivers:** PostgreSQL, MySQL, SQLite, MSSQL

**Isolation Modes:**
- `readonly` — Only SELECT allowed (best-effort string-based guard)
- `transaction` — Wraps in BEGIN/ROLLBACK (always rolls back)
- `none` — No protection

**Step:**
```yaml
- db:
    query: "SELECT * FROM users WHERE id = {userId}"
    assert:
      rowCount: 1
      column: email
      equals: "test@example.com"
    save:
      userName: "$..[0].name"
```

#### Assert Executor (`assert.ts`)

Checks selector visibility and text.

```yaml
- assert:
    selector:
      type: text
      value: "Welcome"
    visible: true
    timeout: 5000
```

#### Screenshot Executor (`screenshot.ts`)

Visual regression baseline/comparison.

```yaml
- screenshot:
    name: "dashboard"
    fullPage: true
    threshold: 0.01
    update: false
```

#### A11y Executor (`a11y.ts`)

Accessibility scanning with axe-core.

```yaml
- a11y:
    run: true
    severity: [critical, serious]
    include: ["button", "input"]
    exclude: [".skip-a11y"]
```

#### Measure Executor (`measure.ts`)

Performance metrics.

```yaml
- measure:
    label: "homepage_load"
    metrics: [loadTime, largestContentfulPaint]
    thresholds:
      loadTime: 2000
      largestContentfulPaint: 2500
```

#### Generate Executor (`generate.ts`)

Data generation.

```yaml
- generate:
    fakeEmail: faker.internet.email
    uniqueId: uuid
```

Saves to step outputs for use in subsequent steps.

#### Mock Executor (`mock.ts`)

Network interception.

```yaml
- mock:
    url: "**/api/products"
    method: GET
    response:
      status: 200
      body: [{ id: 1, name: "Product" }]
```

Scoped to current test, cleaned up after.

#### Eval Executor (`eval.ts`)

Sandboxed JavaScript.

```yaml
- eval:
    script: "shared/custom_steps/verify_token.js"
    input:
      token: "{authToken}"
    output: tokenValid
```

**Sandbox context:**
- ✓ Allowed: `input`, `page` (limited), `Promise`
- ✗ Blocked: `require`, `process`, `globalThis`, file I/O

---

### 7. Schema (`src/schema/`)

**Files:**
- `schemas/` — JSON schema definitions
  - `framework-config.schema.json`
  - `test-definition.schema.json`
  - `page-object.schema.json`
  - `suite.schema.json`
  - etc.
- `validator.ts` — Schema validation using ajv

**Purpose:**
- Validate all YAML files at load time
- Provide helpful error messages with line numbers
- Enable IDE autocomplete (if VS Code schema extensions used)

---

### 8. Types (`src/types/`)

**Files:**
- `index.ts` — All TypeScript type definitions

**Key Types:**
```typescript
interface FrameworkConfig { ... }
interface TestDefinition { ... }
interface PageObject { ... }
interface Suite { ... }
interface Step { ui?, api?, db?, assert?, ... }
interface ExecutionContext { ... }
interface ExecutionFunction { ... }
interface RunConfig { ... }
```

---

### 9. Utils (`src/utils/`)

**Files:**
- `error-formatting.ts` — Format unresolved placeholder errors
- `masking.ts` — Mask secret values in logs
- `debug.ts` — Conditional debug logging

**MaskedValue:**
```typescript
class MaskedValue {
  constructor(private raw: string) {}
  
  toString(): string { return '████████' }
  
  static unwrap(value: unknown): string {
    return value instanceof MaskedValue ? value['raw'] : String(value)
  }
}
```

---

## Core Design Patterns

### 1. Executor Pattern

Each step type has a corresponding executor function:

```typescript
async function executeUiStep(step: UiStep, ctx: ExecutionContext): ExecutionContext {
  // 1. Validate step config
  // 2. Resolve variables in step
  // 3. Perform action
  // 4. Save outputs
  // 5. Return updated context
}
```

Benefits:
- Easy to add new step types (just add executor)
- Testable in isolation
- Clear separation of concerns

### 2. Immutable Context Pattern

Variable resolution uses immutable context:

```typescript
// Load time
const ctx1 = new ConcreteExecutionContext(config, testData)
const ctx2 = ctx1.save('userId', 123)  // New context, doesn't mutate ctx1

// Runtime (execution)
let runtimeCtx = new ConcreteRuntimeContext(page, ctx1)
for (const step of steps) {
  runtimeCtx = await executeStep(step, runtimeCtx)  // New context each step
}
```

Benefits:
- Predictable variable resolution
- Easy to debug (trace which step saves what)
- No accidental mutations

### 3. Registry Pattern

Executors registered centrally:

```typescript
const executors = {
  ui: executeUiStep,
  api: executeApiStep,
  db: executeDbStep,
  // ...
}

function executeStep(step, ctx) {
  const type = Object.keys(step)[0]
  return executors[type](step, ctx)
}
```

Benefits:
- Extensible (add new executors)
- Centralized dispatch
- Easy to validate unknown step types

### 4. Three-Layer Resolution

Variable lookup follows strict precedence:

```
Layer 1: Step Outputs (runtime, highest priority)
         ↓
Layer 2: Test Data (load time)
         ↓
Layer 3: Environment (load time, lowest priority)
```

Benefits:
- Predictable variable scope
- Step outputs can override test data
- Environment variables always lowest priority

---

## Execution Flow

### Complete Test Execution

```
1. CLI (src/cli/index.ts)
   ↓ npm test
   
2. Playwright discovery
   ↓ glob tests/**/*.yaml
   
3. For each test:
   ↓
   a. Load test definition (loader)
   ↓
   b. Load page objects (loader)
   ↓
   c. Load role data (loader)
   ↓
   d. Validate against schema (schema/validator)
   ↓
   e. Resolve all variables (resolver)
   ↓
   f. Create execution context (runner)
   ↓
   g. Run beforeAll hooks (runner/hooks)
   ↓
   h. For each step:
      - Resolve step variables (resolver)
      - Dispatch to executor (executor/index)
      - Execute action (executor/ui, api, db, etc.)
      - Run afterEach hook (runner/hooks)
      - On failure: capture screenshot + DOM
   ↓
   i. Run afterAll hooks (runner/hooks)
   ↓
   j. Collect results
   ↓
   
4. Generate reports
   ↓ JSON, HTML, JUnit, Allure
   
5. Exit with status code
```

### Retry Flow

```
Test A (retry: 2)
├─ Attempt 1
│  ├─ Step 1 ✓
│  ├─ Step 2 ✓
│  └─ Step 3 ✗ (assertion fails)
├─ Attempt 2 (delay + backoff)
│  ├─ Step 1 ✓
│  ├─ Step 2 ✓
│  └─ Step 3 ✓
└─ Result: PASSED
```

---

## Detailed Module Reference

### Placeholder Resolution Examples

**Test Definition:**
```yaml
role: admin
variables:
  timeout: 30000

steps:
  - api:
      method: POST
      url: "ENV.API_BASE_URL/login"
      body:
        email: "{email}"
        password: "{password}"
      save:
        authToken: "$.token"

  - ui:
      pageObject: Dashboard
      action: viewProfile
      timeout: "{timeout}"

  - api:
      method: GET
      url: "ENV.API_BASE_URL/profile/{userId}"
      # {userId} — unresolved, will error unless previous step saved it
```

**Resolution at step 2:**
```
{email}       → "admin@example.com"  (from roles/admin.yaml)
{password}    → ████████             (from roles/admin.yaml, masked)
{timeout}     → 30000                (from test variables)
{authToken}   → "jwt_token_abc123"   (from step 1 save)
ENV.API_BASE_URL → "http://api.example.com" (from .env, masked in logs)
{userId}      → ERROR: Unresolved. Available in: step outputs (none), test data (email, password, timeout), ENV (API_BASE_URL, BASE_URL).
```

### Error Handling Example

**Unresolved placeholder:**
```
Error: Unresolved placeholder "{userId}" in step 2 (api).
  Not found in:
    - step outputs:    []
    - test variables:  [timeout]
    - role data:       [email, password, address]
    - ENV.*:           [API_BASE_URL, BASE_URL, DB_URL]
  Did you mean to add a `save:` to a previous API or db step?
```

**Schema validation error:**
```
Error: Test definition validation failed at tests/login.yaml:
  /steps/0: must have required property "action"
    (did you spell "pageObject" correctly?)
```

### Suite Execution Example

`suites/regression.yaml`:
```yaml
name: "Regression"
config:
  retries: 1
  workers: 2

tests:
  - path: tests/admin_login.yaml
    order: 1
  - path: tests/checkout_flow.yaml
    order: 2
  - path: tests/profile_update.yaml
    order: 3
```

Execution:
```
Worker 1                           Worker 2
├─ admin_login (order 1, time 2s)
├─ profile_update (order 3, time 3s)

└─ checkout_flow (order 2, time 5s)

Total: 5s (parallel)
```

---

## Extending the Framework

### Add a New Step Type

Example: Email verification step

**1. Define step type** (`src/types/index.ts`):
```typescript
interface EmailStep extends BaseStep {
  email: {
    provider: "gmail" | "sendgrid"
    recipient: string
    findText: string
    timeout?: number
    save?: Record<string, any>
  }
}
```

**2. Create executor** (`src/executor/email.ts`):
```typescript
import type { EmailStep, ExecutionContext } from '../types/index.js'

export async function executeEmailStep(
  step: EmailStep,
  ctx: ExecutionContext
): Promise<ExecutionContext> {
  const config = step.email
  
  // Resolve variables
  const recipient = ctx.resolve(config.recipient)
  const text = ctx.resolve(config.findText)
  
  // Fetch email
  const email = await fetchEmail(ctx.config, recipient, text)
  
  if (!email) throw new Error(`Email with "${text}" not found for ${recipient}`)
  
  // Save outputs
  let newCtx = ctx
  if (config.save) {
    for (const [key, jsonPath] of Object.entries(config.save)) {
      const value = JSONPath({ path: jsonPath, json: email })
      newCtx = newCtx.save(key, value)
    }
  }
  
  return newCtx
}
```

**3. Register executor** (`src/executor/index.ts`):
```typescript
import { executeEmailStep } from './email.js'

export const executors = {
  // ... existing executors
  email: executeEmailStep,
}
```

**4. Add to schema** (`src/schema/schemas/test-definition.schema.json`):
```json
{
  "emailStep": {
    "type": "object",
    "properties": {
      "email": {
        "type": "object",
        "properties": {
          "provider": { "enum": ["gmail", "sendgrid"] },
          "recipient": { "type": "string" },
          "findText": { "type": "string" },
          "timeout": { "type": "number" },
          "save": { "type": "object" }
        },
        "required": ["provider", "recipient", "findText"]
      }
    },
    "required": ["email"],
    "additionalProperties": false
  }
}
```

**5. Use in test**:
```yaml
- email:
    provider: gmail
    recipient: "user@example.com"
    findText: "verify your account"
    save:
      verificationLink: "$.body[?(@.text.match(/(verify|confirm)/)].href"
```

---

### Add a New Reporter

Example: Custom Slack reporter

**1. Create reporter** (`src/reporters/slack.ts`):
```typescript
export function reporterSlack(options: { webhookUrl: string }) {
  return {
    onTestEnd(result: TestResult) {
      const message = formatTestForSlack(result)
      await fetch(options.webhookUrl, {
        method: 'POST',
        body: JSON.stringify(message)
      })
    },
    onEnd(suite: Suite) {
      // Final summary
    }
  }
}
```

**2. Register in runner**:
```typescript
if (reporters.includes('slack')) {
  const slackReporter = reporterSlack({ webhookUrl: process.env.SLACK_WEBHOOK })
  // ... attach to test runner
}
```

---

## Testing Infrastructure

### Unit Tests

Located in `src/**/__tests__/*.test.ts`

Run with:
```bash
npm run test:unit
npm run test:unit:watch
npm run test:unit -- --coverage
```

**Current Coverage:**
- `config/__tests__/config-loader.test.ts` — Config loading
- `executor/__tests__/db-readonly-guard.test.ts` — DB isolation
- `executor/__tests__/generate.test.ts` — Data generation
- `schema/__tests__/schema-validator.test.ts` — Schema validation
- `resolver/__tests__/placeholder-resolver.test.ts` — Variable resolution
- `utils/__tests__/error-formatting.test.ts` — Error messages
- `utils/__tests__/masking.test.ts` — Secret masking

### Integration Tests

Example YAML tests in `tests/`:
- `tests/admin_login.yaml` — Login flow
- `tests/checkout_flow.yaml` — Multi-step checkout
- `tests/health_check.yaml` — Smoke test

Run with:
```bash
npm test
npm test -- --tag smoke
npm test -- --suite smoke
```

---

## Performance Considerations

### Parallel Execution

```yaml
# framework.config.yaml
parallel:
  workers: 4          # Use 4 threads
  shard: true
  shardCount: 4
```

Worker allocation:
- Each worker gets independent browser context
- Tests assigned to workers in round-robin
- DB connections isolated per worker (with `isolation: readonly`)

### Optimization Tips

1. **Use `readonly` DB isolation** — Default, parallel-safe
2. **Prefer test tags over suite** — Faster filtering
3. **Avoid `eval:` steps** — Use UI steps when possible
4. **Batch similar tests** — Same page object hits cache
5. **Minimize screenshot threshold** — `visual.threshold: 0.01`

---

## Security Model

### Secret Masking

All values from `.env` are wrapped in `MaskedValue`:
- Logged as `████████` (8 asterisks)
- Logged URLs truncated: `https://api.example.com/...`
- Stack traces sanitized

### Database Isolation

- `readonly` — String-based guard, DB-level enforcement recommended
- `transaction` — Automatic rollback, no data persistence
- `none` — User responsible (not recommended for parallel tests)

### eval: Security

- Sandboxed Node.js VM
- Blocked: `require`, `process`, `globalThis`
- Script must be file path (in `shared/custom_steps/`)
- `allowEval: false` by default in CI
- All executions logged for audit

---

## Debugging Tips

### Enable Debug Output

```bash
DEBUG=speare:* npm test
```

### Use --dry-run

```bash
npm test -- --dry-run --test tests/my_test.yaml
```

Shows resolved variables before execution.

### Capture Screenshots

Screenshots saved on failure:
- Path: `reports/screenshots/`
- Format: `{testName}_{stepIndex}_{timestamp}.png`

### DOM Snapshot

On assertion failure:
- Path: `reports/dom-snapshots/`
- Format: HTML of page at failure time

---

## Contributing

1. Write feature as step executor (follow existing patterns)
2. Add schema validation
3. Add unit tests (aim for >70% coverage)
4. Test end-to-end with example YAML test
5. Add documentation to this file

---

**Last Updated:** 2026-04-13  
**Version:** v0.1.0
