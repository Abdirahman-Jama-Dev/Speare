# Speare — YAML-Driven Playwright Test Framework

A **YAML-only test automation framework** for Playwright, designed for teams that generate AI applications and testers who don't write JavaScript.

> **Write tests in YAML, not JavaScript.** Speare lets you automate full-stack testing (UI, API, database, visual regression, accessibility) using only YAML and `.env`, no coding required.

---

## Quick Start (5 minutes)

### 1. Install

```bash
npm install
npm run setup  # Installs Playwright browsers
```

### 2. Configure `.env`

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with real credentials and URLs:

```bash
# QA Playground Banking App (example)
BASE_URL=https://www.qaplayground.com/bank
API_BASE_URL=https://www.qaplayground.com/api

# Test user credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Optional: Database connection for data validation
DB_URL=postgresql://user:password@localhost:5432/mydb
```

### 3. Create Your First Test

**Step 1: Define the page object** (`pages/login.yaml`)

```yaml
name: LoginPage
url: "/login"

requires:
  - username
  - password

selectors:
  usernameField:
    type: placeholder
    value: "Username"
  passwordField:
    type: placeholder
    value: "Password"
  loginButton:
    type: role
    value: button
    options:
      name: "Login"
  errorMessage:
    type: role
    value: alert

actions:
  login:
    - action: fill
      selector: usernameField
      value: "{username}"
    - action: fill
      selector: passwordField
      value: "{password}"
    - action: click
      selector: loginButton
```

**Step 2: Create test data** (`data/roles/admin.yaml`)

```yaml
username: "ENV.ADMIN_USERNAME"
password: "ENV.ADMIN_PASSWORD"
fullName: "Admin User"
email: "admin@qaplayground.com"
```

**Step 3: Write the test** (`tests/bank_login.yaml`)

```yaml
name: "Bank Admin Login"
tags: [smoke, login, bank]
role: admin

steps:
  - ui:
      pageObject: LoginPage
      action: login

  - assert:
      selector:
        type: text
        value: "Bank"
      visible: true

  - screenshot:
      name: "login_success"
      fullPage: true
```

### 4. Run Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- --test tests/bank_login.yaml

# Preview what will be tested (dry-run - shows resolved variables)
npm test -- --dry-run --test tests/bank_login.yaml

# Run by tag
npm test -- --tag login

# Run with multiple workers (parallel)
npm test -- --workers 4
```

---

## Using Speare in Your Own Project

Instead of writing tests inside the Speare directory, you can use Speare as a dependency in your own project:

### Setup

1. **Install Speare** (via npm when published, or clone locally)
2. **Create your project structure:**
```
your-project/
├── .env
├── framework.config.yaml
├── pages/
│   └── login.yaml
├── tests/
│   └── my_test.yaml
└── data/
    └── roles/
        └── user.yaml
```

3. **Run tests from your project directory:**
```bash
npm test
```

Speare automatically detects `framework.config.yaml` in your project and uses that as the root. No need to copy files into the Speare directory.

**Alternatively**, set the project root explicitly:
```bash
SPEARE_ROOT=/path/to/your/project npm test
```

---

## Performance & Overhead

**Speare has minimal overhead.** YAML files are parsed once at startup (~milliseconds), then interpreted at runtime with negligible dispatch overhead. Test execution time is dominated by Playwright automation (browser interactions, network requests), not by the framework. In practice, Speare tests run at nearly identical speeds to equivalent raw Playwright tests—there's no incentive to bypass the framework for performance reasons.

---

## Complete Real-World Example: Banking App

Let's build a comprehensive test suite for the QA Playground banking application.

### Project Structure

```
speare/
├── .env                              # Your secrets (ignored by git)
├── framework.config.yaml             # Global config
├── pages/
│   ├── login.yaml                    # Login page
│   ├── dashboard.yaml                # Dashboard after login
│   └── transfer.yaml                 # Money transfer form
├── data/
│   └── roles/
│       ├── admin.yaml               # Admin user
│       └── customer.yaml            # Regular customer
├── tests/
│   ├── bank_login.yaml              # Login happy path
│   ├── bank_login_error.yaml        # Failed login
│   ├── bank_transfer.yaml           # Transfer money flow
│   └── bank_logout.yaml             # Logout
└── suites/
    ├── smoke.yaml                   # Quick smoke tests
    └── full.yaml                    # All tests
```

### 1. Page Objects

**`pages/login.yaml`** — Login page selectors and actions

```yaml
name: LoginPage
url: "/login"

requires:
  - username
  - password

selectors:
  usernameInput:
    type: placeholder
    value: "Username"
  passwordInput:
    type: placeholder
    value: "Password"
  submitButton:
    type: role
    value: button
    options:
      name: "Login"
  errorAlert:
    type: role
    value: alert
  loginTitle:
    type: heading
    options:
      level: 1

actions:
  login:
    - action: fill
      selector: usernameInput
      value: "{username}"
    - action: fill
      selector: passwordInput
      value: "{password}"
    - action: click
      selector: submitButton

  logout:
    - action: click
      selector: logoutButton
```

**`pages/dashboard.yaml`** — Dashboard page (after login)

```yaml
name: Dashboard
url: "/dashboard"

selectors:
  welcomeText:
    type: text
    value: "Welcome"
  accountBalance:
    type: role
    value: heading
    options:
      name: /Balance/i
  transferButton:
    type: role
    value: button
    options:
      name: "Transfer Money"
  transactionHistory:
    type: role
    value: table

actions:
  viewBalance:
    - action: textContent
      selector: accountBalance

  startTransfer:
    - action: click
      selector: transferButton
```

**`pages/transfer.yaml`** — Money transfer form

```yaml
name: TransferPage
url: "/transfer"

requires:
  - recipient
  - amount

selectors:
  recipientInput:
    type: label
    value: "Recipient Account"
  amountInput:
    type: label
    value: "Amount"
  submitButton:
    type: role
    value: button
    options:
      name: "Confirm Transfer"
  successMessage:
    type: role
    value: status

actions:
  transferMoney:
    - action: fill
      selector: recipientInput
      value: "{recipient}"
    - action: fill
      selector: amountInput
      value: "{amount}"
    - action: click
      selector: submitButton
```

### 2. Role Data

**`data/roles/admin.yaml`** — Admin user credentials

```yaml
username: "ENV.ADMIN_USERNAME"
password: "ENV.ADMIN_PASSWORD"
fullName: "Admin User"
accountNumber: "1000001"
```

**`data/roles/customer.yaml`** — Regular customer

```yaml
username: "customer"
password: "customer123"
fullName: "John Customer"
accountNumber: "2000001"
email: "customer@bank.com"
```

### 3. Test Cases

**`tests/bank_login.yaml`** — Successful login

```yaml
name: "Admin Login - Success"
tags: [smoke, login, bank]
role: admin
retry: 1

steps:
  - ui:
      pageObject: LoginPage
      action: login

  - assert:
      selector:
        type: text
        value: "Welcome"
      visible: true
      timeout: 5000

  - screenshot:
      name: "dashboard_after_login"
      fullPage: true
```

**`tests/bank_login_error.yaml`** — Invalid credentials

```yaml
name: "Login - Invalid Credentials"
tags: [smoke, login, negative]

variables:
  badPassword: "wrongpassword"

steps:
  - ui:
      pageObject: LoginPage
      action: login
      args:
        password: "{badPassword}"

  - assert:
      selector:
        type: role
        value: alert
      visible: true

  - assert:
      selector:
        type: text
        value: /Invalid username or password/i
      visible: true
```

**`tests/bank_transfer.yaml`** — Complete transfer flow

```yaml
name: "Transfer Money - Happy Path"
tags: [functional, transfer, bank]
role: admin

variables:
  recipientAccount: "2000001"
  transferAmount: "100"

steps:
  # Step 1: Login
  - ui:
      pageObject: LoginPage
      action: login

  - assert:
      selector:
        type: text
        value: "Welcome"
      visible: true

  # Step 2: Navigate to transfer
  - ui:
      pageObject: Dashboard
      action: startTransfer

  # Step 3: Transfer money
  - ui:
      pageObject: TransferPage
      action: transferMoney
      args:
        recipient: "{recipientAccount}"
        amount: "{transferAmount}"

  # Step 4: Verify success
  - assert:
      selector:
        type: role
        value: status
      visible: true

  - assert:
      selector:
        type: text
        value: "Transfer completed"
      visible: true

  # Step 5: Capture success screenshot
  - screenshot:
      name: "transfer_success"
      fullPage: true
```

**`tests/bank_transfer_validation.yaml`** — Transfer with data validation

```yaml
name: "Transfer - Validate Balance Update"
tags: [functional, transfer, validation]
role: admin

variables:
  transferAmount: "50"

steps:
  # Step 1: Login and get initial balance
  - ui:
      pageObject: LoginPage
      action: login

  # Step 2: Capture balance before transfer
  - api:
      method: GET
      url: "ENV.API_BASE_URL/accounts/getBalance"
      assert:
        status: 200
      save:
        initialBalance: "$.balance"

  # Step 3: Perform transfer
  - ui:
      pageObject: Dashboard
      action: startTransfer

  - ui:
      pageObject: TransferPage
      action: transferMoney
      args:
        recipient: "2000001"
        amount: "{transferAmount}"

  # Step 4: Wait for processing
  - assert:
      selector:
        type: text
        value: "Transfer completed"
      visible: true

  # Step 5: Verify new balance
  - api:
      method: GET
      url: "ENV.API_BASE_URL/accounts/getBalance"
      assert:
        status: 200
      save:
        finalBalance: "$.balance"
```

### 4. Test Suites

**`suites/smoke.yaml`** — Quick smoke tests

```yaml
name: "Smoke Tests - Banking"
config:
  retries: 1
  workers: 2
  timeout: 30000

tests:
  - path: tests/bank_login.yaml
    order: 1
  - path: tests/bank_login_error.yaml
    order: 2
```

**`suites/full.yaml`** — Full regression suite

```yaml
name: "Full Regression - Banking"
config:
  retries: 1
  workers: 4

tests:
  - path: tests/bank_login.yaml
    order: 1
  - path: tests/bank_login_error.yaml
    order: 2
  - path: tests/bank_transfer.yaml
    order: 3
  - path: tests/bank_transfer_validation.yaml
    order: 4
```

### 5. Run the Suite

```bash
# Run smoke tests only
npm test -- --suite smoke

# Run full suite
npm test -- --suite full

# Run specific tag
npm test -- --tag transfer

# Run with parallel workers
npm test -- --suite full --workers 4

# Run with sharding (for CI)
npm test -- --suite full --shard=1/4

# Debug a single test
npm test -- --dry-run --test tests/bank_transfer.yaml
```

---

## Advanced Features

### Variables & Data Generation

**Generate test data dynamically:**

```yaml
steps:
  - generate:
      fakeEmail: faker.internet.email
      fakeAmount: faker.finance.amount
      transactionId: uuid

  - api:
      method: POST
      url: "ENV.API_BASE_URL/transfer"
      body:
        recipient: "{recipientEmail}"
        amount: "{fakeAmount}"
        transactionId: "{transactionId}"
      save:
        responseId: "$.id"
```

### Multi-Step Workflows with Data Passing

**Test data flows between steps:**

```yaml
steps:
  # Step 1: Create account via API
  - api:
      method: POST
      url: "ENV.API_BASE_URL/accounts"
      body:
        username: "testuser"
        email: "test@example.com"
      save:
        newAccountId: "$.accountId"
        authToken: "$.token"

  # Step 2: Use data from Step 1 in UI test
  - ui:
      pageObject: AccountPage
      action: loadAccount
      args:
        accountId: "{newAccountId}"

  # Step 3: Verify in database
  - db:
      query: "SELECT * FROM accounts WHERE id = {newAccountId}"
      assert:
        rowCount: 1
        column: "status"
        equals: "active"
```

### API Testing with Assertions

```yaml
steps:
  - api:
      method: GET
      url: "ENV.API_BASE_URL/accounts/balance"
      assert:
        status: 200
        jsonPath: "$.balance"
        equals: 5000
        # OR for numeric comparison
        greaterThan: 0
        lessThan: 100000

  - api:
      method: POST
      url: "ENV.API_BASE_URL/transfer"
      body:
        from: "account1"
        to: "account2"
        amount: 100
      assert:
        status: 201
        jsonPath: "$.status"
        equals: "pending"
      save:
        transactionId: "$.id"
```

### Database Validation

```yaml
database:
  driver: postgres
  connectionString: "ENV.DB_URL"
  isolationMode: readonly  # readonly | transaction | none

steps:
  - db:
      query: "SELECT COUNT(*) as count FROM transactions WHERE status = 'pending'"
      assert:
        rowCount: 1
        column: "count"
        equals: 5
      save:
        pendingCount: "$..[0].count"

  - db:
      query: "SELECT * FROM users WHERE email = {email}"
      assert:
        rowCount: 1
      save:
        userId: "$..[0].id"
```

### Visual Regression Testing

```yaml
steps:
  # Capture baseline
  - screenshot:
      name: "homepage"
      fullPage: true
      update: false  # Set to true first to create baseline

  # Or compare against baseline
  - screenshot:
      name: "homepage"
      threshold: 0.01  # 1% difference allowed
      fullPage: true
```

### Accessibility Testing

```yaml
steps:
  - a11y:
      run: true
      severity: [critical, serious]
      include:
        - button
        - input
        - form
      exclude:
        - ".legacy-component"

  # Fails if critical or serious a11y violations found
```

### Performance Monitoring

```yaml
steps:
  - measure:
      label: "homepage_load"
      metrics:
        - loadTime
        - largestContentfulPaint
        - firstContentfulPaint
        - cumulativeLayoutShift
      thresholds:
        loadTime: 3000
        largestContentfulPaint: 2500
        cumulativeLayoutShift: 0.1
```

### Network Mocking

```yaml
steps:
  # Mock API response
  - mock:
      url: "**/api/accounts/balance"
      method: GET
      response:
        status: 200
        body:
          balance: 99999
          currency: "USD"

  # UI test will see mocked response
  - ui:
      pageObject: Dashboard
      action: viewBalance

  # Assert shows mocked data
  - assert:
      selector:
        type: text
        value: "99999"
      visible: true
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

# Parallel execution
parallel:
  workers: 2
  shardCount: 4

# Database (optional)
database:
  driver: postgres
  connectionString: "ENV.DB_URL"
  ssl: false
  queryTimeout: 5000
  isolationMode: readonly  # readonly | transaction | none

# Visual regression
visual:
  threshold: 0.01
  baselineDir: visual_baselines

# Reporters
reporters:
  - html
  - json
  - junit

# Security
security:
  allowEval: false
```

---

## CLI Commands

```bash
# Run all tests
npm test

# Filter by tag (repeatable)
npm test -- --tag smoke
npm test -- --tag smoke --tag ui

# Exclude tags
npm test -- --exclude slow

# Run specific suite
npm test -- --suite smoke
npm test -- --suite regression

# Run single test
npm test -- --test tests/bank_login.yaml

# Dry-run (preview variables without executing)
npm test -- --dry-run --test tests/bank_transfer.yaml

# Parallel execution
npm test -- --workers 4

# Sharding (for CI matrix jobs)
npm test -- --shard=1/4  # Shard 1 of 4
npm test -- --shard=2/4  # Shard 2 of 4

# Reporters
npm test -- --reporter json --reporter html

# Validate YAML files
npm run validate

# Merge sharded reports
npm run merge-reports
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

      - name: Run tests (shard ${{ matrix.shard }}/4)
        run: npm test -- --shard=${{ matrix.shard }}/4 --reporter=json

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: report-shard-${{ matrix.shard }}
          path: reports/

  merge-reports:
    if: always()
    needs: test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - uses: actions/download-artifact@v4
        with:
          pattern: report-shard-*
          merge-multiple: true
          path: reports/

      - run: npm run merge-reports

      - uses: actions/upload-artifact@v4
        with:
          name: merged-report
          path: reports/
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Unresolved placeholder "{userId}"` | Add `save:` to previous API/db step that returns this value |
| `Selector not found` | Check selector type/value match your app; use `--dry-run` to debug |
| Test times out | Increase `timeout:` in test or `framework.config.yaml` |
| `Authentication failed for GitHub` | Use Personal Access Token instead of password |
| DB readonly error | Ensure you're not trying to INSERT/UPDATE in `isolation: readonly` mode |
| Unable to find page | Check `url:` in page object matches target; verify `BASE_URL` in `.env` |

---

## Project Structure Best Practices

```
tests/
├── smoke/                # Quick sanity checks
│   ├── login.yaml
│   └── logout.yaml
├── functional/           # Feature tests
│   ├── transfer.yaml
│   ├── payment.yaml
│   └── account_management.yaml
├── regression/           # Full coverage
│   ├── edge_cases.yaml
│   └── error_handling.yaml

pages/
├── auth/                 # Authentication pages
│   ├── login.yaml
│   └── password_reset.yaml
├── account/              # Account management
│   ├── profile.yaml
│   ├── settings.yaml
│   └── accounts_list.yaml
└── transactions/         # Transaction pages
    ├── transfer.yaml
    └── payment.yaml

data/
├── roles/
│   ├── admin.yaml
│   ├── customer.yaml
│   ├── customer_vip.yaml
│   └── guest.yaml
└── fixtures/
    ├── valid_emails.yaml
    ├── invalid_emails.yaml
    └── test_accounts.yaml

suites/
├── smoke.yaml            # smoke/ tests only
├── full.yaml             # All tests
├── regression.yaml       # regression/ tests only
└── pre_deploy.yaml       # Critical tests before deploy
```

---

## Next Steps

1. **Review [DOCUMENTS.md](DOCUMENTS.md)** — Complete codebase documentation
2. **Explore examples** — Check `tests/`, `pages/`, `suites/` directories
3. **Run tests** — `npm test -- --suite smoke`
4. **Customize pages** — Add your own page objects in `pages/`
5. **Build test suites** — Organize by feature in `tests/`

---

## Resources

- **RFD v1.2** — Full specification and design document
- **Playwright Docs** — https://playwright.dev
- **Locators** — https://playwright.dev/docs/locators
- **QA Playground** — https://www.qaplayground.com/bank (example site)

---

**Version:** v0.1.0  
**Last Updated:** 2026-04-13  
**License:** Apache 2.0
