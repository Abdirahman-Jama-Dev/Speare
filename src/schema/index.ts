import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createRequire } from 'module';
import type { FrameworkConfig, PageObjectDefinition, RoleData, MockDefinition, SuiteDefinition, TestDefinition } from '../types/index.js';
import type { ErrorObject } from 'ajv';

const require = createRequire(import.meta.url);

// ─── Schema Names ──────────────────────────────────────────────────────────────

export type SchemaName =
  | 'framework-config'
  | 'page-object'
  | 'test-definition'
  | 'role-data'
  | 'mock'
  | 'suite';

type SchemaTypeMap = {
  'framework-config': FrameworkConfig;
  'page-object': PageObjectDefinition;
  'test-definition': TestDefinition;
  'role-data': RoleData;
  'mock': MockDefinition;
  'suite': SuiteDefinition;
};

// ─── Validation Error ──────────────────────────────────────────────────────────

export interface SchemaValidationError {
  readonly path: string;
  readonly message: string;
}

export class YamlValidationError extends Error {
  constructor(
    readonly filePath: string,
    readonly schemaName: SchemaName,
    readonly errors: readonly SchemaValidationError[],
  ) {
    const formatted = errors
      .map((e) => `  - ${e.path || '(root)'}: ${e.message}`)
      .join('\n');
    super(`YAML validation failed for "${filePath}" (schema: ${schemaName}):\n${formatted}`);
    this.name = 'YamlValidationError';
  }
}

// ─── Validator ─────────────────────────────────────────────────────────────────

function buildAjv() {
  // @ts-ignore - ajv types are problematic, but runtime works fine
  const ajv = new Ajv({ allErrors: true, strict: true });
  // @ts-ignore
  addFormats(ajv);

  const schemas: SchemaName[] = [
    'framework-config',
    'page-object',
    'test-definition',
    'role-data',
    'mock',
    'suite',
  ];

  for (const name of schemas) {
    // Schemas are plain JSON — safe to require
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const schema = require(`./schemas/${name}.schema.json`);
    ajv.addSchema(schema, `speare/${name}`);
  }

  return ajv;
}

const ajv = buildAjv();

/**
 * Validate a parsed YAML object against a named schema.
 * Returns the typed value on success.
 * Throws YamlValidationError with detailed messages on failure.
 */
export function validate<K extends SchemaName>(
  filePath: string,
  schemaName: K,
  data: unknown,
): SchemaTypeMap[K] {
  const valid = ajv.validate(`speare/${schemaName}`, data);
  if (!valid) {
    const errors: SchemaValidationError[] = ((ajv.errors as ErrorObject[] | null) ?? []).map((e: ErrorObject) => ({
      path: e.instancePath,
      message: e.message ?? 'unknown error',
    }));
    throw new YamlValidationError(filePath, schemaName, errors);
  }
  return data as SchemaTypeMap[K];
}
