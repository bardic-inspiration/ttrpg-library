// Theme toggle logic (SPEC.md §9.6 "Themes").
import { describe, expect, it } from 'vitest';
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_STORAGE_KEY,
  themeBootstrapScript,
  writeThemeChoice,
  type ThemeRoot,
} from '../../site/src/lib/theme.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const throwing = () => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

const root = (theme?: string): ThemeRoot => ({ dataset: theme ? { theme } : {} });

describe('theme choice storage', () => {
  it('persists Light and Dark, and System clears the stored choice', () => {
    const storage = memoryStorage();
    expect(writeThemeChoice(() => storage, 'dark')).toBe(true);
    expect(readThemeChoice(() => storage)).toBe('dark');
    writeThemeChoice(() => storage, 'light');
    expect(readThemeChoice(() => storage)).toBe('light');
    writeThemeChoice(() => storage, 'system');
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(readThemeChoice(() => storage)).toBe('system');
  });

  it('reads System when nothing valid is stored', () => {
    expect(readThemeChoice(() => memoryStorage())).toBe('system');
    expect(readThemeChoice(() => memoryStorage({ [THEME_STORAGE_KEY]: 'sepia' }))).toBe('system');
  });

  it('falls back to System when storage throws, on access or on use', () => {
    expect(readThemeChoice(throwing)).toBe('system');
    expect(readThemeChoice(() => ({ getItem: throwing }))).toBe('system');
    expect(writeThemeChoice(throwing, 'dark')).toBe(false);
    expect(writeThemeChoice(() => ({ setItem: throwing, removeItem: throwing }), 'dark')).toBe(false);
  });
});

describe('applying a theme', () => {
  it('sets data-theme for Light and Dark and removes it for System', () => {
    const el = root();
    applyThemeChoice(el, 'dark');
    expect(el.dataset.theme).toBe('dark');
    applyThemeChoice(el, 'system');
    expect('theme' in el.dataset).toBe(false);
  });
});

describe('the inline <head> script', () => {
  // Runs the script exactly as the page does, with only `document` and
  // `localStorage` in scope, so it proves the script is self-contained.
  function run(storage: unknown): ThemeRoot {
    const documentElement = root();
    const doc = { documentElement };
    const scope = { get localStorage() { if (storage === throwing) throwing(); return storage; } };
    new Function('document', 'scope', `with (scope) { ${themeBootstrapScript()} }`)(doc, scope);
    return documentElement;
  }

  it('applies a stored theme before first paint', () => {
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' })).dataset.theme).toBe('dark');
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: 'light' })).dataset.theme).toBe('light');
  });

  it('leaves data-theme unset for System, an unknown value, or throwing storage', () => {
    expect(run(memoryStorage()).dataset.theme).toBeUndefined();
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: 'sepia' })).dataset.theme).toBeUndefined();
    expect(run(throwing).dataset.theme).toBeUndefined();
  });
});
