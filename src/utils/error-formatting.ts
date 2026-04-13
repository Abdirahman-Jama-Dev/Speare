/**
 * Suggest close matches for an unresolved placeholder.
 * Uses Levenshtein distance with a configurable maximum distance.
 */

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        (dp[i - 1]![j] ?? Infinity) + 1,
        (dp[i]![j - 1] ?? Infinity) + 1,
        (dp[i - 1]![j - 1] ?? Infinity) + cost,
      );
    }
  }
  return dp[a.length]![b.length] ?? Infinity;
}

/**
 * Find up to `limit` suggestions from `candidates` within `maxDistance`.
 */
export function suggestSimilar(
  needle: string,
  candidates: readonly string[],
  maxDistance = 3,
  limit = 3,
): string[] {
  return candidates
    .map((c) => ({ candidate: c, distance: levenshtein(needle, c) }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/**
 * Format a descriptive error for an unresolved placeholder.
 */
export function formatUnresolvedPlaceholderError(params: {
  placeholder: string;
  stepIndex: number;
  stepType: string;
  stepOutputKeys: readonly string[];
  testDataKeys: readonly string[];
  envKeys: readonly string[];
}): string {
  const { placeholder, stepIndex, stepType, stepOutputKeys, testDataKeys, envKeys } = params;

  const allKeys = [...stepOutputKeys, ...testDataKeys, ...envKeys];
  const suggestions = suggestSimilar(placeholder, allKeys);
  const suggestionLine =
    suggestions.length > 0
      ? `\n  Did you mean: ${suggestions.map((s) => `"${s}"`).join(', ')}?`
      : '\n  Did you mean to add a `save:` to a previous API or db step?';

  return (
    `Error: Unresolved placeholder "${placeholder}" in step ${stepIndex} (${stepType}).\n` +
    `  Not found in:\n` +
    `    - step outputs:    [${stepOutputKeys.join(', ') || 'none'}]\n` +
    `    - test variables:  [${testDataKeys.join(', ') || 'none'}]\n` +
    `    - ENV.*:           [${envKeys.join(', ') || 'none'}]` +
    suggestionLine
  );
}
