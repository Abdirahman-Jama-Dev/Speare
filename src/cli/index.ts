#!/usr/bin/env node
/**
 * Speare CLI entry point.
 *
 * Subcommands:
 *   (default)       Run tests via Playwright
 *   validate        Validate all YAML files against their schemas
 *   merge-reports   Merge sharded JSON report artifacts
 *
 * All options for the default run are passed as env vars to Playwright
 * rather than command-line flags, to avoid Playwright's own flag parsing
 * interfering with ours.
 */
import { Command, Option } from 'commander';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as url from 'url';
import { runDryRun } from './dry-run.js';
import { runValidate } from './validate.js';
import { mergeReports } from './merge-reports.js';
import type { RunConfig } from '../types/index.js';

// ─── Project Root ─────────────────────────────────────────────────────────────

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
// dist/cli/ → project root (two levels up from compiled output)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ─── CLI Definition ───────────────────────────────────────────────────────────

const program = new Command();

program
  .name('speare')
  .description('YAML-driven Playwright test framework')
  .version('0.1.0');

// ─── Default: Run Tests ───────────────────────────────────────────────────────

program
  .command('run', { isDefault: true })
  .description('Run YAML tests via Playwright')
  .addOption(new Option('--tag <tag>', 'Filter by tag (repeatable)').argParser(collectRepeatable))
  .addOption(new Option('--exclude <tag>', 'Exclude by tag (repeatable)').argParser(collectRepeatable))
  .option('--suite <name>', 'Run a named suite (file in suites/)')
  .option('--test <path>', 'Run a single test YAML file')
  .option('--dry-run', 'Resolve variables and print resolution table, then exit')
  .option('--shard <x/n>', 'Shard index in "x/n" format (e.g. --shard=1/4)')
  .option('--workers <n>', 'Override number of parallel workers', parseInt)
  .addOption(
    new Option('--reporter <type>', 'Reporter: json | junit | html | allure (repeatable)')
      .choices(['json', 'junit', 'html', 'allure'])
      .argParser(collectRepeatable),
  )
  .action(async (opts: {
    tag?: string[];
    exclude?: string[];
    suite?: string;
    test?: string;
    dryRun?: boolean;
    shard?: string;
    workers?: number;
    reporter?: string[];
  }) => {
    const runConfig: RunConfig = {
      tags: opts.tag ?? [],
      excludeTags: opts.exclude ?? [],
      suite: opts.suite ?? null,
      testFile: opts.test ?? null,
      dryRun: opts.dryRun ?? false,
      shard: opts.shard ?? null,
      workers: opts.workers ?? null,
      reporters: opts.reporter ?? [],
      projectRoot: PROJECT_ROOT,
    };

    if (runConfig.dryRun) {
      await runDryRun(runConfig);
      return;
    }

    spawnPlaywright(runConfig);
  });

// ─── Validate Command ─────────────────────────────────────────────────────────

program
  .command('validate')
  .description('Validate all YAML files against schemas without running tests')
  .action(async () => {
    await runValidate(PROJECT_ROOT);
  });

// ─── Merge Reports Command ────────────────────────────────────────────────────

program
  .command('merge-reports')
  .description('Merge sharded JSON report artifacts into a single report')
  .action(async () => {
    await mergeReports(PROJECT_ROOT);
  });

// ─── Playwright Spawner ───────────────────────────────────────────────────────

function spawnPlaywright(config: RunConfig): void {
  // Pass all config to Playwright via environment variables.
  // This avoids any conflict with Playwright's own CLI flag handling.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(config.tags.length > 0 ? { SPEARE_TAGS: config.tags.join(',') } : {}),
    ...(config.excludeTags.length > 0 ? { SPEARE_EXCLUDE_TAGS: config.excludeTags.join(',') } : {}),
    ...(config.suite ? { SPEARE_SUITE: config.suite } : {}),
    ...(config.testFile ? { SPEARE_TEST_FILE: config.testFile } : {}),
    ...(config.shard ? { SPEARE_SHARD: config.shard } : {}),
    ...(config.workers ? { SPEARE_WORKERS: String(config.workers) } : {}),
    ...(config.reporters.length > 0 ? { SPEARE_REPORTERS: config.reporters.join(',') } : {}),
  };

  const playwrightArgs = ['playwright', 'test'];

  if (config.shard) {
    playwrightArgs.push(`--shard=${config.shard}`);
  }

  const result = spawnSync('npx', playwrightArgs, {
    env,
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
  });

  process.exit(result.status ?? 1);
}

// ─── Repeatable Option Parser ─────────────────────────────────────────────────

function collectRepeatable(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

// ─── Entry ────────────────────────────────────────────────────────────────────

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`speare error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
