/**
 * Fully resolved configuration for a single test run, built by the CLI
 * and passed to the runner. Combines framework.config.yaml, suite overrides,
 * CLI flags, and shard info.
 */
export interface RunConfig {
  readonly tags: readonly string[];
  readonly excludeTags: readonly string[];
  readonly suite: string | null;
  readonly testFile: string | null;
  readonly dryRun: boolean;
  readonly shard: string | null;
  readonly workers: number | null;
  readonly reporters: readonly string[];

  /** Absolute path to the project root (where framework.config.yaml lives) */
  readonly projectRoot: string;
}
