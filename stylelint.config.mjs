// Stylelint (SPEC.md §9.6, run by `npm run check`). Outside
// site/src/styles/tokens/, a color, font, size, spacing, radius, shadow, or
// duration must come from a token: literal values fail. Percentages, viewport
// units, 0, auto, and keywords stay allowed.

/** Length and time units a design value would be written in. */
const LITERAL_UNITS = [
  'px', 'rem', 'em', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh',
  'pt', 'pc', 'cm', 'mm', 'q', 'in',
  'ms', 's',
];

const TOKEN = '/^var\\(--[a-z0-9-]+\\)$/';

/** @type {import('stylelint').Config} */
export default {
  ignoreFiles: ['site/src/styles/tokens/**', '**/dist/**', '**/node_modules/**'],
  reportNeedlessDisables: true,
  reportDescriptionlessDisables: true,
  overrides: [{ files: ['**/*.astro', '**/*.html'], customSyntax: 'postcss-html' }],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],
    'unit-disallowed-list': LITERAL_UNITS,
    'declaration-property-value-allowed-list': {
      font: [TOKEN, 'inherit'],
      'font-family': [TOKEN, 'inherit'],
      'font-size': [TOKEN, 'inherit', '100%'],
      'font-weight': [TOKEN, 'inherit', 'normal'],
      'line-height': [TOKEN, 'inherit', 'normal'],
      '/^(box|text)-shadow$/': [TOKEN, 'none'],
    },
  },
};
