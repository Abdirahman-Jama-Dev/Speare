import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { validate } from '../schema/index.js';
import { listYamlFiles, resolveFromRoot } from '../utils/path-resolution.js';
import type {
  TestDefinition,
  PageObjectDefinition,
  RoleData,
  MockDefinition,
  SuiteDefinition,
} from '../types/index.js';

// ─── Generic YAML Parser ───────────────────────────────────────────────────────

export function parseYamlFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: "${filePath}"`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(raw);
}

// ─── Typed Loaders ─────────────────────────────────────────────────────────────

export function loadTestDefinition(filePath: string): TestDefinition {
  return validate(filePath, 'test-definition', parseYamlFile(filePath));
}

export function loadPageObject(filePath: string): PageObjectDefinition {
  return validate(filePath, 'page-object', parseYamlFile(filePath));
}

export function loadRoleData(filePath: string): RoleData {
  return validate(filePath, 'role-data', parseYamlFile(filePath));
}

export function loadMockDefinition(filePath: string): MockDefinition {
  return validate(filePath, 'mock', parseYamlFile(filePath));
}

export function loadSuiteDefinition(filePath: string): SuiteDefinition {
  return validate(filePath, 'suite', parseYamlFile(filePath));
}

// ─── Page Object Registry ──────────────────────────────────────────────────────

/**
 * Load all page objects from the pages/ directory.
 * Returns a map of page name → definition.
 */
export async function loadPageObjectRegistry(
  projectRoot: string,
): Promise<Map<string, PageObjectDefinition>> {
  const pagesDir = resolveFromRoot(projectRoot, 'pages');
  const files = await listYamlFiles(pagesDir);
  const registry = new Map<string, PageObjectDefinition>();

  for (const file of files) {
    const po = loadPageObject(file);
    if (registry.has(po.name)) {
      throw new Error(
        `Duplicate page object name "${po.name}" found in:\n` +
          `  - ${registry.get(po.name)?.name}\n` +
          `  - ${file}`,
      );
    }
    registry.set(po.name, po);
  }

  return registry;
}

// ─── Test Discovery ────────────────────────────────────────────────────────────

export interface DiscoveredTest {
  readonly filePath: string;
  readonly definition: TestDefinition;
}

/**
 * Discover all test files in tests/ and return loaded definitions.
 * Applies tag/exclude filters if provided.
 */
export async function discoverTests(params: {
  projectRoot: string;
  tags?: readonly string[];
  excludeTags?: readonly string[];
  singleFile?: string;
}): Promise<DiscoveredTest[]> {
  const { projectRoot, tags, excludeTags, singleFile } = params;

  let files: string[];

  if (singleFile) {
    const resolved = resolveFromRoot(projectRoot, singleFile);
    files = [resolved];
  } else {
    const testsDir = resolveFromRoot(projectRoot, 'tests');
    files = await listYamlFiles(testsDir);
  }

  const discovered: DiscoveredTest[] = [];

  for (const filePath of files) {
    const definition = loadTestDefinition(filePath);

    if (tags && tags.length > 0) {
      const testTags = definition.tags ?? [];
      if (!tags.some((t) => testTags.includes(t))) continue;
    }

    if (excludeTags && excludeTags.length > 0) {
      const testTags = definition.tags ?? [];
      if (excludeTags.some((t) => testTags.includes(t))) continue;
    }

    discovered.push({ filePath, definition });
  }

  return discovered;
}

// ─── Data Import Loader ────────────────────────────────────────────────────────

/**
 * Resolve all data: imports in a test definition, merging the results
 * into a single flat record for layer-2 resolution.
 */
export function resolveDataImports(
  projectRoot: string,
  definition: TestDefinition,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const entry of definition.data ?? []) {
    if ('import' in entry) {
      const filePath = resolveFromRoot(projectRoot, entry.import);
      const parsed = parseYamlFile(filePath);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.assign(merged, parsed);
      }
    } else {
      Object.assign(merged, entry);
    }
  }

  return merged;
}

// ─── Suite Loader ──────────────────────────────────────────────────────────────

export interface ResolvedSuiteTest {
  readonly filePath: string;
  readonly order: number;
}

/**
 * Load a suite definition and return an ordered list of test file paths.
 * Handles both string entries and { path, order } entries.
 */
export function resolveSuiteTests(
  projectRoot: string,
  suite: SuiteDefinition,
): ResolvedSuiteTest[] {
  const entries = suite.tests.map((entry, index) => {
    if (typeof entry === 'string') {
      return { filePath: resolveFromRoot(projectRoot, entry), order: index };
    }
    return {
      filePath: resolveFromRoot(projectRoot, entry.path),
      order: entry.order ?? index,
    };
  });

  return entries.sort((a, b) => a.order - b.order);
}

// ─── Matrix Expansion ──────────────────────────────────────────────────────────

export interface MatrixTestRun {
  readonly matrixEnv: Record<string, string>;
  readonly tests: ResolvedSuiteTest[];
}

/**
 * Expand a suite's matrix into multiple runs.
 * Currently supports a single matrix dimension (env key with array values).
 * Returns one MatrixTestRun per combination.
 */
export function expandMatrixSuite(
  projectRoot: string,
  suite: SuiteDefinition,
): MatrixTestRun[] {
  const tests = resolveSuiteTests(projectRoot, suite);

  if (!suite.matrix || Object.keys(suite.matrix).length === 0) {
    return [{ matrixEnv: {}, tests }];
  }

  // Compute cartesian product of all matrix dimensions
  const dimensions = Object.entries(suite.matrix);
  const combinations = dimensions.reduce<Array<Record<string, string>>>(
    (acc, [key, values]) => {
      if (acc.length === 0) return values.map((v) => ({ [key]: v }));
      return acc.flatMap((existing) => values.map((v) => ({ ...existing, [key]: v })));
    },
    [],
  );

  return combinations.map((matrixEnv) => ({ matrixEnv, tests }));
}
