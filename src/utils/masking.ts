import { isMaskedValue, maskDisplay } from '../types/masked-value.js';

const MASK_CHAR = '█';
const MASK_LENGTH = 8;
const MASK_STRING = MASK_CHAR.repeat(MASK_LENGTH);

/**
 * Mask a value for display in logs, dry-run output, and reports.
 * MaskedValue instances are replaced with ████████.
 * All other values are returned as-is.
 */
export function mask(value: unknown): unknown {
  if (isMaskedValue(value)) return maskDisplay(value);
  return value;
}

/**
 * Replace all ENV.* occurrences in a string with ████████ for safe logging.
 */
export function maskString(input: string): string {
  return input.replace(/ENV\.\w+/g, MASK_STRING);
}

/**
 * Deep-walk an object and replace any MaskedValue with its display string.
 * Returns a plain, JSON-safe object suitable for reporters.
 */
export function maskDeep(value: unknown): unknown {
  if (isMaskedValue(value)) return maskDisplay(value);
  if (Array.isArray(value)) return value.map(maskDeep);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, maskDeep(v)]),
    );
  }
  return value;
}
