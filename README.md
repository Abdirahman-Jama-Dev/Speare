# Speare — YAML-Driven Playwright Test Framework

A **YAML-only test automation framework** for Playwright, designed for teams that generate AI applications and testers who don't write JavaScript.

> **Write tests in YAML, not JavaScript.** Speare lets you automate full-stack testing (UI, API, database, visual regression, accessibility) using only YAML and `.env`, no coding required.

---

## Quick Start

### 1. Install

```bash
npm install
npm run setup  # Installs Playwright browsers
```

### 2. Configure `.env`

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:3000/api
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your_password
DB_URL=postgresql://user:password@localhost:5432/mydb
```

### 3. Write a Test

Create `tests/my_first_test.yaml`:

```yaml
name: "User login"
tags: [smoke, ui]
role: admin

steps:
  - ui:
      pageObject: LoginPage
      action: login

  - assert:
      selector:
        type: text
        value: "Welcome"
      visible: true

  - api:
      method: GET
      url: "ENV.API_BASE_URL/profile"
      assert:
        status: 200
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run by tag
npm test -- --tag smoke

# Run single test with variable preview
npm test -- --dry-run --test tests/my_first_test.yaml

# Run with sharding (CI)
npm test -- --shard=1/4 --workers=2
```

---

## Project Structure

```
speare/
├── .env.example                # Template for secrets (safe to commit)
├── .env                        # Actual secrets (DO NOT commit)
├── framework.config.yaml       # Framework configuration
├── pages/                      # Page Object definitions (selectors + actions)
├── data/
│   └── roles/                  # Role-based test data (admin, customer, guest)
├── tests/                      # YAML test definitions
├── suites/                     # Named test collections with ordering
├── mocks/                      # Network mock responses
├── shared/
│   └── custom_steps/           # JavaScript for eval: steps (auditable, versioned)
├── src/                        # TypeScript framework source (internal)
└── visual_baselines/           # Baseline screenshots for visual regression
```

---

## Stack

| Component | Purpose |
|-----------|---------|
| **Playwright** | Browser automation (Chrome, Firefox, Safari) |
| **Node.js** | Runtime + CLI |
| **TypeScript** | Framework internals (compiled to JS) |
| **YAML** | Test definitions + configuration |
| **Vitest** | Unit test runner |
| **Better-sqlite3** | SQLite driver |
| **pg** | PostgreSQL driver |
| **mysql2** | MySQL driver |
| **mssql** | SQL Server driver |
| **axe-core** | Accessibility testing |
| **@faker-js/faker** | Test data generation |
| **js-yaml** | YAML parsing |
| **jsonpath-plus** | Extract values from API responses + DB results |

---

## Architecture

### Three-Layer Execution Model

```
YAML Config
    ↓
Loader (parse YAML, resolve imports)
    ↓
Variable Resolver (3-layer: step outputs → test data → ENV)
    ↓
Executor Registry (dispatch to UI/API/DB/Assert/Screenshot/A11y/Measure/Eval steps)
    ↓
Playwright (browser automation)
    ↓
Test Report (JSON, HTML, JUnit, Allure)
```

### Core Concepts

**Page Objects** (`pages/*.yaml`)
- Define resilient selectors using Playwright locators: `role`, `text`, `label`, `placeholder`, `testId`, `alt`, `title`
- Bundle selectors into **actions** (reusable workflows)
- Example: `LoginPage` → `login` action fills username/password, clicks submit

**Role Data** (`data/roles/*.yaml`)
- Credentials and context-specific test data (admin, customer, guest)
- Loaded automatically based on `role:` in test definition
- Credentials masked in logs

**Variable Resolution** (3 layers, highest to lowest priority)
1. **Step outputs** — values saved from previous steps (API response, DB query result)
2. **Test data** — role data + test variables + imports
3. **Environment** — `.env` (masked in logs)

**Steps** (execution units)
| Step Type | Purpose |
|-----------|---------|
| `ui:` | Click, fill, navigate using page objects |
| `api:` | HTTP request + assertions (status, JSON path) |
| `db:` | SQL query + assertions (row count, column value) |
| `assert:` | Selector visibility, text presence |
| `mock:` | Network interception (stub API responses) |
| `screenshot:` | Visual regression baseline/comparison |
| `a11y:` | Accessibility scan (axe-core) |
| `measure:` | Performance metrics (LCP, CLS, etc.) |
| `generate:` | Generate fake data (uuid, faker.internet.email) |
| `eval:` | Run sandboxed JavaScript (audited, allowlisted) |

---

## Key Features

### ✅ Resilient by Default
- Only Playwright's semantic locators allowed (no brittle CSS/XPath)
- Page Objects encourage reuse and maintainability

### ✅ Data Separation
- Secrets live in `.env`, never in YAML
- Role-based test data kept separate from test logic

### ✅ Full-Stack Testing
- UI (Playwright)
- API (fetch, assertions on status/JSON path)
- Database (readonly isolation, optional transaction rollback)
- Visual regression (baseline screenshots)
- Accessibility (axe-core rules)
- Performance (metrics collection)

### ✅ CI/CD Ready
- Sharding: `--shard=x/n` for parallel matrix jobs
- Filtering: tags, suites, individual tests
- Standard reporters: JSON, HTML, JUnit, Allure

### ✅ AI-Friendly
- YAML syntax optimized for LLM generation
- Clear error messages and dry-run previews
- Deterministic execution

### ✅ Extensible
- Add custom step types as plugins
- Eval: step for one-off logic (sandboxed, auditable)
- Custom reporters

---

## CLI Commands

```bash
# Run tests (default)
npm test

# Filtering
npm test -- --tag smoke                    # Tag-based
npm test -- --exclude slow                 # Exclude tags
npm test -- --suite regression             # By suite name
npm test -- --test tests/login.yaml        # Single test

# Execution
npm test -- --workers 4                    # Parallel workers
npm test -- --shard=2/4                    # CI sharding (e.g., shard 2 of 4)

# Reporters
npm test -- --reporter json --reporter html

# Debugging
npm test -- --dry-run --test tests/login.yaml   # Preview resolved variables

# Validation
npm run validate                            # Validate all YAML files

# Reports
npm run merge-reports                       # Merge sharded report artifacts
```

---

## Example Test: Admin Login

**Page Object** (`pages/login.yaml`):
```yaml
name: LoginPage
url: "/login"

requires:
  - username
  - password

selectors:
  usernameField:
    type: placeholder
    value: "Email address"
  passwordField:
    type: placeholder
    value: "Password"
  submitButton:
    type: role
    value: button
    options:
      name: "Sign in"

actions:
  login:
    - action: fill
      selector: usernameField
      value: "{username}"
    - action: fill
      selector: passwordField
      value: "{password}"
    - action: click
      selector: submitButton
```

**Test** (`tests/admin_login.yaml`):
```yaml
name: "Admin login"
tags: [smoke, ui, critical]
role: admin

steps:
  - ui:
      pageObject: LoginPage
      action: login

  - assert:
      selector:
        type: text
        value: "Welcome"
      visible: true

  - api:
      method: GET
      url: "ENV.API_BASE_URL/profile"
      assert:
        status: 200
        jsonPath: "$.role"
        equals: "admin"

  - screenshot:
      name: "dashboard_after_login"
      fullPage: true
```

**Run**:
```bash
npm test -- --test tests/admin_login.yaml
```

---

## Configuration

### Global Config (`framework.config.yaml`)

```yaml
# URLs
baseUrl: "ENV.BASE_URL"
apiBaseUrl: "ENV.API_BASE_URL"

# Execution
retries: 1
timeout: 30000

parallel:
  workers: 2

# Database (optional)
database:
  driver: postgres
  connectionString: "ENV.DB_URL"
  isolationMode: readonly  # readonly | transaction | none

# Visual regression
visual:
  threshold: 0.01
  baselineDir: visual_baselines

# Reporters
reporters:
  - html
  - json
```

### Per-Suite Config (`suites/smoke.yaml`)

```yaml
name: "Smoke Suite"

config:
  retries: 0
  workers: 4
  timeout: 20000

tests:
  - path: tests/health_check.yaml
    order: 1
  - path: tests/login.yaml
    order: 2
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm test -- --shard=${{ matrix.shard }}/4 --reporter=json
      - uses: actions/upload-artifact@v4
        with:
          name: report-shard-${{ matrix.shard }}
          path: reports/

  merge-reports:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: report-shard-*
          merge-multiple: true
      - run: npm run merge-reports
      - uses: actions/upload-artifact@v4
        with:
          name: merged-report
          path: reports/
```

---

## Security

- **Secrets**: Always use `.env`, referenced via `ENV.KEY` (masked in logs)
- **Database**: Isolation modes protect against state leakage (`readonly` mode for parallel tests)
- **eval: step**: Sandboxed JavaScript, requires explicit `allowEval: true` config
- **Network**: Mocks are scoped to test execution, cleaned up automatically

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Unresolved placeholder "{userId}"` | Add `save:` to previous API/db step, or define in test variables |
| `ENOENT: no such file or directory` (page not found) | Verify page name matches YAML filename, selector names match |
| Test times out | Increase `timeout:` in framework.config.yaml or individual test |
| Selector not found | Check selector type + value match your app; use `--dry-run` to preview |
| DB connection refused | Verify `DB_URL` in `.env`, database is running |

---

## What's Next

- Read [DOCUMENTS.md](DOCUMENTS.md) for detailed codebase walkthrough
- Check `tests/`, `pages/`, `suites/` for examples
- See RFD v1.2 spec document for design rationale

---

## License

Apache 2.0 (or specify your license)  
Designed for AI-generated applications and non-JS test authors.
