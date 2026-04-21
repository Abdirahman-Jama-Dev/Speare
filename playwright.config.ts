import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as url from 'url';
import { loadConfig } from './src/config/index.js';

if (!process.env.SPEARE_ROOT) {
  console.warn(
    '[Speare] SPEARE_ROOT is not set — falling back to the framework directory.\n' +
    '         Did you mean to run via the Speare CLI? Set SPEARE_ROOT to your project root.',
  );
}

const PROJECT_ROOT = process.env.SPEARE_ROOT ?? path.resolve(url.fileURLToPath(new URL('.', import.meta.url)));
const { frameworkConfig } = loadConfig(PROJECT_ROOT);

const workers = (Number(process.env['SPEARE_WORKERS'] ?? 0) || frameworkConfig.parallel?.workers) ?? 1;
const shardArg = process.env['SPEARE_SHARD'] ?? null;

// Parse "x/n" shard string
const shard = shardArg
  ? (() => {
      const [current, total] = shardArg.split('/').map(Number);
      if (!current || !total) throw new Error(`Invalid shard format: "${shardArg}". Expected "x/n"`);
      return { current, total };
    })()
  : null;

const reporters: Parameters<typeof defineConfig>[0]['reporter'] = [];
const reporterList = process.env['SPEARE_REPORTERS']?.split(',').filter(Boolean)
  ?? frameworkConfig.reporters
  ?? ['html'];

for (const r of reporterList) {
  switch (r) {
    case 'json':   reporters.push(['json', { outputFile: path.join(PROJECT_ROOT, 'reports/results.json') }]); break;
    case 'junit':  reporters.push(['junit', { outputFile: path.join(PROJECT_ROOT, 'reports/results.xml') }]); break;
    case 'html':   reporters.push(['html', { outputFolder: path.join(PROJECT_ROOT, 'reports/html') }]); break;
    case 'allure': reporters.push(['allure-playwright']); break;
  }
}
reporters.push(['list']); // always show live output

export default defineConfig({
  // The single entry point that generates tests from YAML
  testMatch: ['**/runner/playwright-entry.ts'],

  fullyParallel: true,
  workers,
  retries: 0, // Retries are managed per-test via test.describe.configure

  timeout: frameworkConfig.timeout ?? 30_000,

  shard: shard ?? undefined,

  reporter: reporters,

  outputDir: path.join(PROJECT_ROOT, 'reports/artifacts'),

  use: {
    baseURL: frameworkConfig.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
