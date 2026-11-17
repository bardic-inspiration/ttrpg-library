// The source allowlist (docs/licensing.md#source-allowlist): config/licenses.json and its checks.
import { describe, expect, it } from 'vitest';
import { accepts, checkLicenses } from '../lib/licenses.ts';
import { loadLicenses } from '../scripts/validate/index.ts';
import { PROJECT_ROOT } from '../scripts/validate/schema.ts';

describe('config/licenses.json', () => {
  it('is valid, and accepts CC0 and CC-BY for imports, and public domain too for art', async () => {
    const licenses = await loadLicenses(PROJECT_ROOT);
    expect(licenses.kinds).toEqual({
      import: ['CC0-1.0', 'CC-BY-2.0', 'CC-BY-3.0', 'CC-BY-4.0'],
      art: ['public-domain', 'CC0-1.0', 'CC-BY-2.0', 'CC-BY-3.0', 'CC-BY-4.0'],
    });
    expect(accepts(licenses, 'import', 'CC-BY-4.0')).toBe(true);
    expect(accepts(licenses, 'import', 'public-domain')).toBe(false);
    expect(accepts(licenses, 'import', 'CC-BY-SA-4.0')).toBe(false);
    expect(accepts(licenses, 'video', 'CC0-1.0')).toBe(false);
  });

  it('reports each problem with a licenses object', () => {
    expect(checkLicenses([])).toEqual(['must be an object with `licenses` and `kinds`']);
    expect(
      checkLicenses({
        licenses: { 'CC0-1.0': { name: '', url: 'http://x' }, 'bad id': { name: 'X', url: 'https://x', note: 1 } },
        kinds: { import: ['CC0-1.0', 'CC0-1.0', 'MIT'], art: [] },
        extra: true,
      }),
    ).toEqual([
      'extra: unknown key',
      'licenses.CC0-1.0.name: must be a non-empty string',
      'licenses.CC0-1.0.url: must be an https URL',
      'licenses.bad id: an id is an SPDX id or "public-domain"',
      'licenses.bad id.note: unknown key',
      'kinds.import: "MIT" isn\'t in licenses',
      'kinds.import: lists a license twice',
      'kinds.art: must be a non-empty list of license ids',
    ]);
  });
});
