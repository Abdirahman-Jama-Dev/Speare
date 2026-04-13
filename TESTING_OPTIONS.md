# Testing Options Breakdown

## Option 1: Build and Test (RECOMMENDED)

**What it does:**
- Compiles TypeScript source code to JavaScript
- Runs tests against the compiled code
- Source code stays untouched
- All test outputs go to `reports/` and `visual_baselines/` (git-ignored)

**Pros:**
- ✅ Simplest
- ✅ Tests real compiled code (what users will run)
- ✅ Fast (no cloning, same machine)
- ✅ Source code never touched
- ✅ Safe for repeatedly testing

**Cons:**
- ❌ Need to rebuild after each source code change

**Steps:**
```bash
# 1. Compile TypeScript → JavaScript
npm run build

# 2. Run tests
npm test

# 3. Or run specific test
npm test -- --test tests/admin_login.yaml

# 4. Or run with tag
npm test -- --tag smoke

# 5. Check results in reports/
ls -la reports/
```

**What happens:**
```
src/ (untouched)
dist/ (compiled JavaScript - test runs this)
reports/ (test outputs - auto-created, git-ignored)
├── report.json
├── report.html
└── screenshots/
```

**When to use:**
- First time testing the framework
- Quick smoke tests
- CI/CD pipeline

---

## Option 2: Git Worktree (BEST ISOLATION)

**What it does:**
- Creates a separate copy of the repo in a different directory
- Completely isolated from your main codebase
- Same git history, separate working directory
- Can delete worktree when done (no mess left behind)

**Pros:**
- ✅ Completely isolated (zero risk to main codebase)
- ✅ Can have different branches/states simultaneously
- ✅ Perfect for testing before merging
- ✅ Clean up is automatic (just delete worktree)
- ✅ Professional workflow (used in large teams)

**Cons:**
- ❌ Slightly more setup
- ❌ Extra disk space for second copy
- ❌ Need to cd between directories

**Steps:**
```bash
# 1. Create isolated worktree
git worktree add ../speare-test

# 2. Navigate to it
cd ../speare-test

# 3. Install dependencies (fresh copy)
npm install

# 4. Compile and run tests
npm run build
npm test

# 5. Or run specific tests
npm test -- --test tests/admin_login.yaml
npm test -- --suite smoke

# 6. When done, go back
cd ../speare

# 7. Clean up worktree
git worktree remove ../speare-test
```

**What happens:**
```
speare/                    (original - untouched)
├── src/
├── dist/
└── reports/

speare-test/               (worktree - isolated copy)
├── src/
├── dist/
└── reports/

# After done: speare-test/ is deleted completely
```

**When to use:**
- Experimental changes you might discard
- Testing breaking changes
- Parallel testing on different branches
- Ensuring nothing affects main repo

---

## Option 3: Run Tests Directly (QUICKEST)

**What it does:**
- Just run tests immediately without building
- Tests still output to `reports/` (git-ignored)
- Source code never changes
- Minimal overhead

**Pros:**
- ✅ Fastest (no build step if already compiled)
- ✅ Simplest command
- ✅ Minimum overhead
- ✅ Source code protected (reports/ is git-ignored)

**Cons:**
- ❌ Requires `dist/` already exists (from previous build)
- ❌ If you change source, need to rebuild
- ❌ Not ideal for source code modifications

**Steps:**
```bash
# 1. Just run (assumes dist/ already exists)
npm test

# 2. Run specific test
npm test -- --test tests/admin_login.yaml

# 3. Run by tag
npm test -- --tag smoke

# 4. Run with debug output
npm test -- --dry-run --test tests/admin_login.yaml

# 5. Check results
ls -la reports/
cat reports/report.json
```

**Protected by Git:**
```
.gitignore includes:
- reports/
- dist/
- visual_baselines/
- node_modules/

So even if you run 1000 tests, git status shows nothing changed
```

**When to use:**
- Quick smoke tests
- Testing against live site (QA Playground)
- Validating framework works
- Demo/presentations

---

## Comparison Table

| Factor | Option 1: Build+Test | Option 2: Worktree | Option 3: Direct |
|--------|----------------------|-------------------|------------------|
| **Safety** | Very Safe | Extremely Safe | Very Safe |
| **Speed** | Medium (need build) | Slow (clone files) | Fast |
| **Isolation** | Good | Perfect | Good |
| **Disk Space** | 1x | 2x | 1x |
| **Setup** | 2 commands | 3 commands | 1 command |
| **Cleanup** | Auto (reports/) | Manual (rm worktree) | Auto (reports/) |
| **Change Source?** | No | Maybe | No |
| **First Time?** | ✅ Use this | ❌ Overkill | ✅ Use this |
| **Test Before Merge?** | ✅ Good | ✅ Best | ✅ Good |
| **Experimental?** | ✅ OK | ✅ Perfect | ❌ Not ideal |

---

## Recommended Workflow

### For Quick Testing (Right Now)

```bash
# 1. Compile once
npm run build

# 2. Run tests as many times as you want
npm test
npm test -- --tag smoke
npm test -- --test tests/admin_login.yaml

# 3. Everything stays clean
git status  # → nothing changed (reports/ is ignored)
```

### For Experimental Changes

```bash
# 1. Create isolated worktree
git worktree add ../speare-test

# 2. Try changes in worktree
cd ../speare-test
# make changes, test them, break things
npm run build
npm test

# 3. Go back to main repo (worktree left untouched)
cd ../speare

# 4. If you like the changes, manually copy them
# or sync from worktree

# 5. Clean up when done
git worktree remove ../speare-test
```

### For CI/CD Pipeline

```bash
# Already implies Option 1
npm run build
npm test -- --reporter json --reporter html
```

---

## Git Protection (Everything is Safe)

The `.gitignore` protects these directories:

```
# These are never committed:
reports/                  # Test results
dist/                     # Compiled JS
visual_baselines/         # Screenshots
node_modules/             # Dependencies
.env                      # Secrets
```

So even if you:
- Run 10,000 tests
- Generate 5GB of screenshots
- Randomly modify files

**Git sees no changes:**
```bash
git status
# On branch master
# nothing to commit, working tree clean ✓
```

---

## My Recommendation

**Start with Option 1 (Build + Test):**

```bash
npm run build     # One-time compile
npm test          # Run tests

# Check results
cat reports/report.html  # Open in browser
```

Then if you want to test source code changes:
- Edit `src/` files
- Run `npm run build` again
- Run `npm test` again

**Use Option 2 (Worktree) only if:**
- You're making big experimental changes
- You want zero risk to main code
- You want to preserve current state while testing

**Use Option 3 (Direct) if:**
- You just want to verify it works once
- You're not changing anything
