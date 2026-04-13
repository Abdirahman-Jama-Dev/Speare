import * as fs from 'fs';
import * as path from 'path';

// ─── Report Merge ─────────────────────────────────────────────────────────────

/**
 * Merge multiple sharded JSON report files into a single combined report.
 * Looks for reports/shard-*.json or reports/results*.json in the reports/ dir.
 */
export async function mergeReports(projectRoot: string): Promise<void> {
  const reportsDir = path.join(projectRoot, 'reports');

  if (!fs.existsSync(reportsDir)) {
    process.stderr.write('reports/ directory not found. Nothing to merge.\n');
    process.exit(1);
  }

  const entries = fs.readdirSync(reportsDir);
  const jsonFiles = entries
    .filter((f) => f.endsWith('.json') && !f.startsWith('merged'))
    .map((f) => path.join(reportsDir, f));

  if (jsonFiles.length === 0) {
    process.stdout.write('No JSON report files found to merge.\n');
    return;
  }

  interface TestResult {
    title: string;
    status: string;
    [key: string]: unknown;
  }

  interface Report {
    suites?: Record<string, unknown>;
    tests?: TestResult[];
    stats?: Record<string, unknown>;
    [key: string]: unknown;
  }

  const allTests: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const filePath of jsonFiles) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const report = JSON.parse(raw) as Report;
    const tests: TestResult[] = report.tests ?? [];
    allTests.push(...tests);

    for (const test of tests) {
      if (test.status === 'passed') totalPassed++;
      else if (test.status === 'failed') totalFailed++;
      else totalSkipped++;
    }
  }

  const merged = {
    mergedAt: new Date().toISOString(),
    shards: jsonFiles.length,
    stats: { total: allTests.length, passed: totalPassed, failed: totalFailed, skipped: totalSkipped },
    tests: allTests,
  };

  const outPath = path.join(reportsDir, 'merged-results.json');
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));

  process.stdout.write(
    `Merged ${jsonFiles.length} shard(s) → ${path.relative(projectRoot, outPath)}\n` +
      `  Total: ${allTests.length} | Passed: ${totalPassed} | Failed: ${totalFailed} | Skipped: ${totalSkipped}\n`,
  );

  if (totalFailed > 0) process.exit(1);
}
