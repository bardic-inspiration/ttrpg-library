import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listEntryFiles } from './walk.ts';

export interface ValidationError {
  file: string;
  message: string;
}

export interface ValidationResult {
  files: string[];
  errors: ValidationError[];
}

/**
 * Validates every entry under `root`. For now each file must parse as JSON;
 * the schema stage and consistency checks (SPEC.md §6.8) arrive with the
 * ruleset module (#6).
 */
export async function validateLibrary(root: string): Promise<ValidationResult> {
  const files = await listEntryFiles(root);
  const errors: ValidationError[] = [];
  for (const file of files) {
    try {
      JSON.parse(await readFile(join(root, file), 'utf8'));
    } catch (error) {
      errors.push({ file, message: `invalid JSON: ${(error as Error).message}` });
    }
  }
  return { files, errors };
}
