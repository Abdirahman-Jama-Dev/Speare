import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { validate } from '../schema/index.js';
import type { FrameworkConfig } from '../types/index.js';
import { assertFileExists } from '../utils/path-resolution.js';

// ─── .env Loader ───────────────────────────────────────────────────────────────

/**
 * Load and parse a .env file, returning a plain key→value map.
 * Does NOT mutate process.env — the resolver reads this map directly.
 */
export function loadEnvFile(projectRoot: string): Record<string, string> {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return {};

  const raw = fs.readFileSync(envPath, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    // Strip optional surrounding quotes from value
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, '');
    result[key] = value;
  }

  return result;
}

// ─── Framework Config Loader ───────────────────────────────────────────────────

const CONFIG_FILE = 'framework.config.yaml';

/**
 * Load and validate framework.config.yaml from the project root.
 * Returns an empty config object if the file does not exist (all defaults apply).
 */
export function loadFrameworkConfig(projectRoot: string): FrameworkConfig {
  const configPath = path.join(projectRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return {};
  }

  assertFileExists(configPath);
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed: unknown = yaml.load(raw);

  return validate(configPath, 'framework-config', parsed);
}

// ─── Merged Config ─────────────────────────────────────────────────────────────

export interface LoadedConfig {
  readonly frameworkConfig: FrameworkConfig;
  /** Raw env key→value map (not yet masked) */
  readonly env: Readonly<Record<string, string>>;
}

export function loadConfig(projectRoot: string): LoadedConfig {
  const env = loadEnvFile(projectRoot);
  const frameworkConfig = loadFrameworkConfig(projectRoot);
  return { frameworkConfig, env };
}
