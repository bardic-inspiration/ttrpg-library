// Theme choice (SPEC.md §9.6 "Themes"): System, Light, or Dark, stored in
// localStorage. Every storage read and write is wrapped in try/catch, so a
// browser that blocks storage degrades to System instead of breaking.

export const THEME_STORAGE_KEY = 'ttrpg-library:theme';
export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** Anything with a `data-theme` dataset: <html>, or a test double. */
export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
}

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);

/** The stored choice, or `system` when nothing valid is stored or storage throws. */
export function readThemeChoice(getStorage: () => Pick<Storage, 'getItem'>): ThemeChoice {
  try {
    const stored = getStorage().getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Stores the choice (System clears it). Returns false when storage throws. */
export function writeThemeChoice(getStorage: () => Pick<Storage, 'setItem' | 'removeItem'>, choice: ThemeChoice): boolean {
  try {
    const storage = getStorage();
    if (choice === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

/** Sets `data-theme` for Light or Dark; System removes it so the media query decides. */
export function applyThemeChoice(root: ThemeRoot, choice: ThemeChoice): void {
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
}

/**
 * Runs inline in <head> before first paint. It must be self-contained: it is
 * serialized with toString(), so it can't reference anything outside itself.
 */
function themeBootstrap(root: ThemeRoot, getStorage: () => Pick<Storage, 'getItem'>, key: string): void {
  try {
    const stored = getStorage().getItem(key);
    if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;
  } catch {
    // Storage unavailable: leave data-theme unset and follow the system.
  }
}

/** The inline <head> script that applies a stored theme before first paint. */
export const themeBootstrapScript = (): string =>
  `(${themeBootstrap.toString()})(document.documentElement, function () { return localStorage; }, ${JSON.stringify(THEME_STORAGE_KEY)});`;
