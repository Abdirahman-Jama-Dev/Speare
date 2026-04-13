import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve a path relative to the project root.
 * If the path is already absolute, returns it unchanged.
 */
export function resolveFromRoot(projectRoot: string, filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(projectRoot, filePath);
}

/**
 * Assert that a file exists and is readable.
 * Throws with a descriptive message if not.
 */
export function assertFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: "${filePath}"`);
  }
}

/**
 * List all YAML files matching a glob pattern within a directory.
 */
export async function listYamlFiles(dir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml')))
    .map((e) => path.join(dir, e.name));
}
