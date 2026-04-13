import { createMaskedValue, isMaskedValue } from '../types/masked-value.js';
import { formatUnresolvedPlaceholderError } from '../utils/error-formatting.js';

// ─── Placeholder Rules ─────────────────────────────────────────────────────────
//
// Two syntaxes are supported:
//   1. ENV.KEYNAME  — Resolved from the env layer. May appear inline in strings.
//                     The value is wrapped in MaskedValue for safe log output.
//   2. {variableName} — Resolved from step-outputs → test-data layers, in order.
//                       May appear inline in strings.
//   3. Bare exact match — If an entire string value equals a known key in any
//                         layer (useful for role data: `password: "ENV.X"` is
//                         already handled by rule 1; this covers test variable
//                         references in args/assert values).
// ─────────────────────────────────────────────────────────────────────────────

const ENV_INLINE_RE = /ENV\.([A-Z0-9_]+)/g;
const BRACE_RE = /\{([^{}]+)\}/g;

// ─── Resolution Context ────────────────────────────────────────────────────────

export interface ResolutionLayers {
  /** Layer 3 — .env values keyed by name (without the ENV. prefix) */
  readonly env: Readonly<Record<string, string>>;
  /** Layer 2 — role data + test variables + data imports */
  readonly testData: Readonly<Record<string, unknown>>;
  /** Layer 1 — accumulated save: outputs from previous steps */
  readonly stepOutputs: Readonly<Record<string, unknown>>;
}

export class UnresolvedPlaceholderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnresolvedPlaceholderError';
  }
}

// ─── Core Lookup ───────────────────────────────────────────────────────────────

/**
 * Look up a key across all three layers.
 * Returns { value, found: true } or { found: false }.
 */
function lookup(
  key: string,
  layers: ResolutionLayers,
): { found: true; value: unknown } | { found: false } {
  // Layer 1 — step outputs (highest priority)
  if (Object.prototype.hasOwnProperty.call(layers.stepOutputs, key)) {
    return { found: true, value: layers.stepOutputs[key] };
  }
  // Layer 2 — test data
  if (Object.prototype.hasOwnProperty.call(layers.testData, key)) {
    return { found: true, value: layers.testData[key] };
  }
  // Layer 3 — env (ENV.KEY syntax strips the ENV. prefix for lookup)
  if (Object.prototype.hasOwnProperty.call(layers.env, key)) {
    return { found: true, value: createMaskedValue(layers.env[key] as string) };
  }
  return { found: false };
}

// ─── String Interpolation ──────────────────────────────────────────────────────

/**
 * Interpolate ENV.KEY and {key} placeholders within a string.
 * If the entire string is a single placeholder, returns the raw value (may be non-string).
 * If the string is composite (placeholder + other text), returns a string.
 * Throws UnresolvedPlaceholderError for any unresolved key.
 */
export function interpolateString(
  input: string,
  layers: ResolutionLayers,
  stepIndex: number,
  stepType: string,
): unknown {
  // Fast path: bare ENV.KEY (entire string)
  if (/^ENV\.[A-Z0-9_]+$/.test(input)) {
    const key = input.slice(4); // strip "ENV."
    const result = lookup(key, layers);
    if (!result.found) {
      throwUnresolved(input, stepIndex, stepType, layers);
    }
    return result.value;
  }

  // Fast path: bare {key} (entire string)
  if (/^\{[^{}]+\}$/.test(input)) {
    const key = input.slice(1, -1);
    const result = lookup(key, layers);
    if (!result.found) {
      throwUnresolved(key, stepIndex, stepType, layers);
    }
    return result.value;
  }

  // Fast path: bare key exact match (entire string equals a known key)
  const bareResult = lookup(input, layers);
  if (bareResult.found) {
    return bareResult.value;
  }

  // Composite string: replace all ENV.KEY and {key} occurrences
  let output = input;
  let hasSubstitution = false;

  // Replace ENV.KEY occurrences
  output = output.replace(ENV_INLINE_RE, (match, key: string) => {
    const envVal = layers.env[key];
    if (envVal === undefined) {
      throwUnresolved(match, stepIndex, stepType, layers);
    }
    hasSubstitution = true;
    // In composite strings we cannot return a MaskedValue; use the raw value.
    // The masking layer will mask it in logs via maskDeep on the whole object.
    return envVal;
  });

  // Replace {key} occurrences
  output = output.replace(BRACE_RE, (match, key: string) => {
    const result = lookup(key, layers);
    if (!result.found) {
      throwUnresolved(key, stepIndex, stepType, layers);
    }
    hasSubstitution = true;
    const val = result.value;
    if (isMaskedValue(val)) return val.value;
    return String(val);
  });

  if (!hasSubstitution) {
    // Nothing was substituted — return as-is (it's a literal string)
    return output;
  }

  return output;
}

// ─── Deep Resolve ──────────────────────────────────────────────────────────────

/**
 * Recursively resolve all string values within an arbitrary value.
 * Arrays and plain objects are walked. Non-string primitives are returned as-is.
 */
export function resolveDeep(
  value: unknown,
  layers: ResolutionLayers,
  stepIndex: number,
  stepType: string,
): unknown {
  if (typeof value === 'string') {
    return interpolateString(value, layers, stepIndex, stepType);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveDeep(item, layers, stepIndex, stepType));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        resolveDeep(v, layers, stepIndex, stepType),
      ]),
    );
  }
  return value;
}

// ─── Error Helper ──────────────────────────────────────────────────────────────

function throwUnresolved(
  placeholder: string,
  stepIndex: number,
  stepType: string,
  layers: ResolutionLayers,
): never {
  const msg = formatUnresolvedPlaceholderError({
    placeholder,
    stepIndex,
    stepType,
    stepOutputKeys: Object.keys(layers.stepOutputs),
    testDataKeys: Object.keys(layers.testData),
    envKeys: Object.keys(layers.env),
  });
  throw new UnresolvedPlaceholderError(msg);
}
