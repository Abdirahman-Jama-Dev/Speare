import { isMaskedValue, maskDisplay } from '../types/masked-value.js';
import type { ResolutionLayers } from './placeholder-resolver.js';

// ─── Source Labels ─────────────────────────────────────────────────────────────

type ValueSource = 'step outputs' | 'test variables' | 'ENV (masked)' | 'ENV' | 'generate (runtime)';

interface ResolvedEntry {
  readonly key: string;
  readonly displayValue: string;
  readonly source: ValueSource;
}

// ─── Dry-Run Output ────────────────────────────────────────────────────────────

/**
 * Produce a formatted dry-run report for all resolvable values in a context.
 * This is the primary debugging tool for YAML authors.
 */
export function formatDryRunReport(layers: ResolutionLayers, testName: string): string {
  const entries: ResolvedEntry[] = [];

  // Layer 1 — step outputs (not yet known at dry-run time)
  for (const [key] of Object.entries(layers.stepOutputs)) {
    entries.push({ key, displayValue: '(resolved at runtime)', source: 'step outputs' });
  }

  // Layer 2 — test data
  for (const [key, value] of Object.entries(layers.testData)) {
    if (isMaskedValue(value)) {
      entries.push({ key, displayValue: maskDisplay(value), source: 'ENV (masked)' });
    } else if (typeof value === 'string' && value.startsWith('generate.')) {
      entries.push({ key, displayValue: '(resolved at runtime)', source: 'generate (runtime)' });
    } else {
      entries.push({ key, displayValue: JSON.stringify(value), source: 'test variables' });
    }
  }

  // Layer 3 — env
  for (const key of Object.keys(layers.env)) {
    // Only show env vars not already shadowed by testData
    if (!Object.prototype.hasOwnProperty.call(layers.testData, key)) {
      entries.push({ key, displayValue: maskDisplay({ __masked: true, value: '' }), source: 'ENV (masked)' });
    }
  }

  // Format as aligned table
  const maxKeyLen = Math.max(...entries.map((e) => e.key.length), 10);
  const maxValLen = Math.max(...entries.map((e) => e.displayValue.length), 10);

  const header = `[dry-run] Test: "${testName}"\n[variables resolved]\n`;
  const rows = entries
    .map((e) => {
      const key = e.key.padEnd(maxKeyLen);
      const val = e.displayValue.padEnd(maxValLen);
      return `  ${key}  →  ${val}  (source: ${e.source})`;
    })
    .join('\n');

  return header + rows + '\n';
}
