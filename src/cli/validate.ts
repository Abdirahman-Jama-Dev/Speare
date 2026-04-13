import * as path from 'path';
import { loadConfig } from '../config/index.js';
import { listYamlFiles } from '../utils/path-resolution.js';
import { validate } from '../schema/index.js';
import { parseYamlFile } from '../loader/index.js';
import type { SchemaName } from '../schema/index.js';

// ─── Directory → Schema Mapping ───────────────────────────────────────────────

const DIR_SCHEMA_MAP: ReadonlyArray<{ dir: string; schema: SchemaName }> = [
  { dir: 'tests', schema: 'test-definition' },
  { dir: 'pages', schema: 'page-object' },
  { dir: 'mocks', schema: 'mock' },
  { dir: 'suites', schema: 'suite' },
  { dir: 'data/roles', schema: 'role-data' },
];

// ─── Validate Command ─────────────────────────────────────────────────────────

/**
 * Validate all YAML files in the project against their schemas.
 * Prints a summary. Exits 1 if any file fails validation.
 */
export async function runValidate(projectRoot: string): Promise<void> {
  // Always validate the framework config first
  loadConfig(projectRoot); // throws on invalid config

  const errors: string[] = [];
  let totalFiles = 0;

  for (const { dir, schema } of DIR_SCHEMA_MAP) {
    const dirPath = path.join(projectRoot, dir);
    const files = await listYamlFiles(dirPath);

    for (const filePath of files) {
      totalFiles++;
      try {
        const parsed = parseYamlFile(filePath);
        validate(filePath, schema, parsed);
        process.stdout.write(`  OK   ${path.relative(projectRoot, filePath)}\n`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(errMsg);
        process.stderr.write(`  FAIL ${path.relative(projectRoot, filePath)}\n       ${errMsg}\n`);
      }
    }
  }

  process.stdout.write(`\nValidated ${totalFiles} file(s). ${errors.length} error(s).\n`);

  if (errors.length > 0) {
    process.exit(1);
  }
}
