// scripts/srd-extract (docs/architecture.md#repository-layout): the SRD import sessions' extraction
// module. It reads the PDF with pdfplumber, which CI doesn't install, so CI checks only that it compiles.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('scripts/srd-extract', () => {
  it('compiles', () => {
    const file = join(import.meta.dirname, '../scripts/srd-extract/srd_extract.py');
    expect(() => execFileSync('python3', ['-m', 'py_compile', file], { stdio: 'pipe' })).not.toThrow();
  });
});
