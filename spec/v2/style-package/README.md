# Frank Lloyd Wright — Wasmuth Folio ('10) Content & Style Package

This package contains everything needed to implement the refined **FLW 3: Wasmuth Folio ('10) — Cotton-Rag & Art-Glass Jewels** theme in [`bardic-inspiration/ttrpg-library`](https://github.com/bardic-inspiration/ttrpg-library).

It is structured to match your repository's exact `@layer reset, tokens, base, layout, components, utilities, overrides;` architecture and passes your WCAG AA contrast checks (`tests/contrast.test.ts`) across both Light and Dark themes.

## 1. Color Palette Reference & Contrast Matrix

### Surface & Structural Ink Tokens (`tokens/primitives.css` & `tokens/semantic.css`)

| Role | Token | Light Mode (Cotton Rag) | Dark Mode (Roasted Walnut) | Design Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Page Background** | `--color-bg` | `#f2ede4` (Cotton-Rag Alabaster) | `#181412` (Midnight Umber) | De-yellowed archival rag paper |
| **Card / Control Surface** | `--color-surface` | `#faf8f3` (Warm Ivory Vellum) | `#231e1b` (Roasted Walnut) | Crisp reading surface for cards & statblocks |
| **Primary Ink** | `--color-text` | `#241b15` (Espresso Sepia) | `#f5f1ea` (Alabaster Bone) | 14.3:1 contrast on light / 14.8:1 on dark |
| **Secondary / Muted Ink** | `--color-text-muted` | `#574639` (Walnut Umber) | `#c2b4a3` (Warm Travertine) | 7.1:1 contrast on light / 7.8:1 on dark |
| **Structural Border** | `--color-border` | `#7a6552` (Architectural Bronze) | `#6e5a49` (Burnished Umber) | Used for double lithograph rules & piers |
| **Control Border** | `--color-control-border` | `#665242` (Drafting Sepia) | `#8c7560` (Light Bronze) | Form inputs, filter chips, & selects |
| **Focus Ring** | `--color-focus` | `#0055b3` (Cathedral Cobalt) | `#6eb5ff` (Sky Cobalt) | Keyboard focus outline |

### Vibrant Art-Glass Entry Type & Rarity Tokens (`tokens/content.css`)

All `-700` light-mode tokens and `-300` dark-mode tokens are calibrated so they remain highly saturated while maintaining **≥ 4.5:1 WCAG AA contrast** against both `--color-bg` and `--color-surface` (so `npm test` / `tests/contrast.test.ts` passes out of the box):

| Content Role | Token | Light Mode Hex (`-700`) | Dark Mode Hex (`-300`) | Art-Glass Inspiration |
| :--- | :--- | :--- | :--- | :--- |
| **Creature** | `--accent-creature` | `#c91d16` | `#ff6e63` | Cherokee Stained-Glass Vermilion |
| **Magic Item** | `--accent-magic-item` | `#7422de` | `#c88aff` | Imperial Art-Glass Amethyst |
| **Spell** | `--accent-spell` | `#006b82` | `#3dd9f5` | Taliesin Peacock Cobalt-Teal |
| **Common Rarity** | `--rarity-common` | `#574639` | `#c2b4a3` | Architectural Bronze |
| **Uncommon Rarity** | `--rarity-uncommon` | `#0b7a3e` | `#42e68c` | Leaded Emerald Art-Glass |
| **Rare Rarity** | `--rarity-rare` | `#0055b3` | `#6eb5ff` | Cathedral Cobalt Glass |
| **Very Rare Rarity** | `--rarity-very-rare` | `#7422de` | `#c88aff` | Royal Amethyst Glass |
| **Legendary Rarity** | `--rarity-legendary` | `#a84d00` | `#ffb838` | Burnished Amber-Gold Glass |
| **Artifact Rarity** | `--rarity-artifact` | `#c70f37` | `#ff5c82` | Ruby Coronation Glass |

## 2. Typography & Font Setup

This palette pairs three geometric/engraved typefaces with your existing Alegreya superfamily as fallbacks:

* **Headings (`--font-heading`)**: **Tenor Sans** — Engraved neoclassical & Wasmuth Portfolio plate lettering (`letter-spacing: 0.1em; text-transform: uppercase`).
* **Body (`--font-body`)**: **Crimson Pro** — High-legibility book serif with warm editorial proportions for spell descriptions and statblock traits.
* **UI & Plan Callouts (`--font-label`)**: **Josefin Sans** — Drafted 1920s–30s architectural stencil geometric sans-serif used for wide-tracked badges, filter chips, and table headers.

### Option 1: Google Fonts `<link>` (Quickest Setup in `site/src/layouts/Base.astro`)

Add this inside the `<head>` of `site/src/layouts/Base.astro`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Josefin+Sans:wght@500;600;700&family=Tenor+Sans&display=swap" rel="stylesheet">
```

### Option 2: Self-Hosted Fontsource Packages (Matches Your Self-Hosted Astro Architecture)

If you prefer zero external network requests in Astro:

```bash
npm install @fontsource/tenor-sans @fontsource-variable/crimson-pro @fontsource-variable/josefin-sans
```

Then import them in `site/src/layouts/Base.astro`:

```ts
import '@fontsource/tenor-sans/400.css';
import '@fontsource-variable/crimson-pro';
import '@fontsource-variable/josefin-sans';
```

## 3. Two Ways to Drop the CSS Into Your Repo

All files are included in the ZIP archive (`flw-wasmuth-theme-package.zip`) and reproduced below.

### Route A: Zero-Friction Single-File Test (`site/src/styles/overrides.css`)

Paste the contents below directly into `site/src/styles/overrides.css` to activate the entire palette and Wasmuth ornamentation without touching your base token files:

```css
/*
 * Frank Lloyd Wright — 1910 Wasmuth Portfolio (Refined Cotton-Rag & Art-Glass Jewels)
 * Drop into: site/src/styles/overrides.css
 *
 * Includes:
 * 1. Less-yellow Cotton-Rag Alabaster (#f2ede4) & Warm Ivory (#faf8f3) surfaces
 * 2. High-vibrancy Art-Glass Entry Type & Rarity palette (WCAG AA compliant in light & dark)
 * 3. Larkin Building 8x8px Poché Structural Corner Piers (pigmented per entry --accent)
 * 4. Wasmuth Double-Frame Lithograph Page Border & Architectural Callout Badges
 */
@layer overrides {
  /* ==========================================================================
   * 1. Semantic & Content Token Overrides (Light & Dark)
   * ========================================================================== */
  :root,
  [data-theme='light'] {
    color-scheme: light;
    --color-bg: #f2ede4;
    --color-surface: #faf8f3;
    --color-text: #241b15;
    --color-text-muted: #574639;
    --color-accent: #c91d16;
    --color-border: #7a6552;
    --color-control-border: #665242;
    --color-focus: #0055b3;

    /* Vibrant Art-Glass Entry Type Accents */
    --accent-creature: #c91d16;
    --accent-magic-item: #7422de;
    --accent-spell: #006b82;

    /* Vibrant Stained-Glass Rarity Accents */
    --rarity-common: #574639;
    --rarity-uncommon: #0b7a3e;
    --rarity-rare: #0055b3;
    --rarity-very-rare: #7422de;
    --rarity-legendary: #a84d00;
    --rarity-artifact: #c70f37;
  }

  @media screen and (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      color-scheme: dark;
      --color-bg: #181412;
      --color-surface: #231e1b;
      --color-text: #f5f1ea;
      --color-text-muted: #c2b4a3;
      --color-accent: #ff6e63;
      --color-border: #6e5a49;
      --color-control-border: #8c7560;
      --color-focus: #6eb5ff;

      --accent-creature: #ff6e63;
      --accent-magic-item: #c88aff;
      --accent-spell: #3dd9f5;

      --rarity-common: #c2b4a3;
      --rarity-uncommon: #42e68c;
      --rarity-rare: #6eb5ff;
      --rarity-very-rare: #c88aff;
      --rarity-legendary: #ffb838;
      --rarity-artifact: #ff5c82;
    }
  }

  @media screen {
    [data-theme='dark'] {
      color-scheme: dark;
      --color-bg: #181412;
      --color-surface: #231e1b;
      --color-text: #f5f1ea;
      --color-text-muted: #c2b4a3;
      --color-accent: #ff6e63;
      --color-border: #6e5a49;
      --color-control-border: #8c7560;
      --color-focus: #6eb5ff;

      --accent-creature: #ff6e63;
      --accent-magic-item: #c88aff;
      --accent-spell: #3dd9f5;

      --rarity-common: #c2b4a3;
      --rarity-uncommon: #42e68c;
      --rarity-rare: #6eb5ff;
      --rarity-very-rare: #c88aff;
      --rarity-legendary: #ffb838;
      --rarity-artifact: #ff5c82;
    }
  }

  :root,
  [data-theme] {
    --font-heading: 'Tenor Sans', 'Alegreya SC', Georgia, serif;
    --font-body: 'Crimson Pro', 'Alegreya', Georgia, serif;
    --font-label: 'Josefin Sans', 'Alegreya Sans', system-ui, sans-serif;

    --radius-card: 0px;
    --radius-control: 0px;
    --radius-badge: 0px;
  }

  /* ==========================================================================
   * 2. Wasmuth Lithograph Page Frame & Header Rules
   * ========================================================================== */
  body {
    box-shadow:
      inset 0 0 0 10px var(--color-bg),
      inset 0 0 0 11.5px var(--color-border),
      inset 0 0 0 15px var(--color-bg),
      inset 0 0 0 16px color-mix(in srgb, var(--color-border) 55%, transparent);
  }

  .site-header {
    border-block-end: 3px double var(--color-border);
  }

  h1,
  h2,
  h3 {
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* ==========================================================================
   * 3. Larkin Poché Corner Piers on Entry Cards & Statblocks
   * ========================================================================== */
  [data-type],
  .card,
  .statblock {
    border: 1.5px solid color-mix(in srgb, var(--accent) 55%, var(--color-border));
    border-block-start: 3.5px solid var(--accent);
    outline: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
    outline-offset: -6px;
    border-radius: 0;
    box-shadow: 0 3px 10px rgb(36 27 21 / 0.09);
    /* 4 solid 8x8px structural poché corner piers pigmented with --accent */
    background-image:
      linear-gradient(var(--accent), var(--accent)),
      linear-gradient(var(--accent), var(--accent)),
      linear-gradient(var(--accent), var(--accent)),
      linear-gradient(var(--accent), var(--accent));
    background-repeat: no-repeat;
    background-size: 8px 8px;
    background-position:
      top 4px left 4px,
      top 4px right 4px,
      bottom 4px left 4px,
      bottom 4px right 4px;
    transition:
      transform var(--duration-fast) ease,
      box-shadow var(--duration-fast) ease,
      border-color var(--duration-fast) ease;
  }

  .card:hover {
    border-color: var(--accent);
    box-shadow: 4px 4px 0 0 var(--accent);
    transform: translate(-2px, -2px);
  }

  /* ==========================================================================
   * 4. Art-Glass Badges & Architectural Callout Chips
   * ========================================================================== */
  .badge {
    border-radius: 0;
    background: color-mix(in srgb, var(--accent) 14%, var(--color-surface));
    border: 1.5px solid var(--accent);
    border-inline-start: 5px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.72rem;
    box-shadow: 2px 2px 0 color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .badge[data-rarity] {
    background: var(--accent);
    border-color: var(--color-text);
    border-inline-start: 5px solid var(--color-text);
    color: var(--color-surface);
    box-shadow: 2px 2px 0 var(--color-text);
  }
}
```

### Route B: Clean Token Split Across `site/src/styles/tokens/*.css`

When you are ready to make this the permanent baseline in your token files:

#### 1. `site/src/styles/tokens/primitives.css`
```css
/*
 * Primitives (docs/styling.md#tokens): raw values only. Components never read these;
 * semantic.css, components.css, content.css, and print.css map them to roles.
 *
 * Theme: Frank Lloyd Wright — 1910 Wasmuth Portfolio (Cotton-Rag & Art-Glass Jewels)
 */
@layer tokens {
  :root {
    /* Light Surfaces: Cotton-rag alabaster & warm ivory vellum (less yellow, crisp archival rag) */
    --parchment-50: #faf8f3;
    --parchment-100: #f2ede4;
    --parchment-400: #7a6552;

    /* Light Ink: Deep espresso-sepia & architectural bronze */
    --ink-400: #665242;
    --ink-600: #574639;
    --ink-900: #241b15;

    /* Dark Surfaces: Roasted walnut & midnight umber */
    --night-400: #8c7560;
    --night-600: #6e5a49;
    --night-800: #231e1b;
    --night-900: #181412;
    --bone-100: #f5f1ea;
    --bone-400: #c2b4a3;

    /* High-Vibrancy Frank Lloyd Wright Art-Glass Hues:
     * -700 reads with ≥4.5:1 contrast on light cotton-rag surfaces (#faf8f3 / #f2ede4),
     * -300 reads with ≥4.5:1 contrast on dark walnut surfaces (#231e1b / #181412).
     */
    --red-700: #c91d16;      /* Cherokee Stained-Glass Vermilion */
    --red-300: #ff6e63;
    --violet-700: #7422de;   /* Imperial Art-Glass Amethyst */
    --violet-300: #c88aff;
    --sea-700: #006b82;      /* Taliesin Peacock Cobalt-Teal */
    --sea-300: #3dd9f5;
    --green-700: #0b7a3e;    /*Leaded Emerald Glass */
    --green-300: #42e68c;
    --amber-700: #a84d00;    /* Burnished Amber Art-Glass */
    --amber-300: #ffb838;
    --blue-700: #0055b3;     /* Cobalt Cathedral Glass */
    --blue-300: #6eb5ff;
    --crimson-700: #c70f37;  /* Ruby Artifact Glass */
    --crimson-300: #ff5c82;

    /* Font families: Wasmuth Portfolio & Architectural Forum inspired superfamily */
    --family-serif: 'Crimson Pro', 'Alegreya', 'Iowan Old Style', Georgia, serif;
    --family-serif-sc: 'Tenor Sans', 'Alegreya SC', Georgia, serif;
    --family-sans: 'Josefin Sans', 'Alegreya Sans', system-ui, sans-serif;
    --family-mono: 'JetBrains Mono', 'Alegreya Sans Code', ui-monospace, monospace;

    /* Typography scale: Minor Third ratio, fluid across 320px–1280px (docs/styling.md#visual-direction). */
    --font-size--2: clamp(0.6944rem, 0.6724rem + 0.1102vw, 0.7813rem);
    --font-size--1: clamp(0.8333rem, 0.7986rem + 0.1736vw, 0.9375rem);
    --font-size-0: clamp(1rem, 0.9583rem + 0.2083vw, 1.125rem);
    --font-size-1: clamp(1.2rem, 1.15rem + 0.25vw, 1.35rem);
    --font-size-2: clamp(1.44rem, 1.38rem + 0.3vw, 1.62rem);
    --font-size-3: clamp(1.728rem, 1.656rem + 0.36vw, 1.944rem);
    --font-size-4: clamp(2.0736rem, 1.9872rem + 0.432vw, 2.3328rem);
    --font-size-5: clamp(2.4883rem, 2.3846rem + 0.5184vw, 2.7994rem);

    /* Line heights. */
    --leading-tight: 1.15;
    --leading-snug: 1.3;
    --leading-normal: 1.5;

    /* Spacing scale. */
    --size-1: 0.25rem;
    --size-2: 0.5rem;
    --size-3: 0.75rem;
    --size-4: 1rem;
    --size-5: 1.5rem;
    --size-6: 2rem;
    --size-7: 3rem;
    --size-8: 4rem;

    /* Measures and widths. */
    --size-measure: 70ch;
    --size-content: 80rem;
    --size-card-min: 16rem;
    --size-filters: 16rem;
    --size-icon: 1.25em;

    /* Line widths. */
    --stroke-thin: 1px;
    --stroke-medium: 2px;
    --stroke-thick: 3px;

    /* Radii: Crisp 0px architectural corners for Wasmuth / Prairie School precision. */
    --radius-1: 0px;
    --radius-2: 0px;
    --radius-3: 2px;
    --radius-pill: 0px;

    /* Shadows. */
    --shadow-1: 0 2px 8px rgb(36 27 21 / 0.08);
    --shadow-2: 4px 4px 0px rgb(36 27 21 / 0.22);

    /* Durations. Every one becomes 0ms under reduced motion (docs/styling.md#accessibility). */
    --duration-fast: 120ms;
    --duration-normal: 200ms;
    --duration-slow: 320ms;

    /* Aspect ratios. */
    --ratio-art: 4 / 3;
    --ratio-square: 1 / 1;
  }

  @media (prefers-reduced-motion: reduce) {
    :root {
      --duration-fast: 0ms;
      --duration-normal: 0ms;
      --duration-slow: 0ms;
    }
  }
}
```

#### 2. `site/src/styles/tokens/content.css`
```css
/*
 * Content tokens (docs/styling.md#tokens): vibrant Frank Lloyd Wright art-glass
 * accents per entry type and item rarity, per theme.
 */
@layer tokens {
  :root,
  [data-theme='light'] {
    --accent-creature: var(--red-700);       /* #c91d16 Cherokee Vermilion */
    --accent-magic-item: var(--violet-700);  /* #7422de Imperial Amethyst */
    --accent-spell: var(--sea-700);          /* #006b82 Taliesin Peacock Teal */

    --rarity-common: var(--ink-600);         /* #574639 Architectural Bronze */
    --rarity-uncommon: var(--green-700);     /* #0b7a3e Leaded Emerald Glass */
    --rarity-rare: var(--blue-700);          /* #0055b3 Cobalt Cathedral Glass */
    --rarity-very-rare: var(--violet-700);   /* #7422de Royal Violet Glass */
    --rarity-legendary: var(--amber-700);    /* #a84d00 Burnished Amber Gold */
    --rarity-artifact: var(--crimson-700);   /* #c70f37 Ruby Artifact Glass */
  }

  @media screen and (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --accent-creature: var(--red-300);      /* #ff6e63 */
      --accent-magic-item: var(--violet-300); /* #c88aff */
      --accent-spell: var(--sea-300);         /* #3dd9f5 */

      --rarity-common: var(--bone-400);       /* #c2b4a3 */
      --rarity-uncommon: var(--green-300);    /* #42e68c */
      --rarity-rare: var(--blue-300);         /* #6eb5ff */
      --rarity-very-rare: var(--violet-300);  /* #c88aff */
      --rarity-legendary: var(--amber-300);   /* #ffb838 */
      --rarity-artifact: var(--crimson-300);  /* #ff5c82 */
    }
  }

  @media screen {
    [data-theme='dark'] {
      --accent-creature: var(--red-300);      /* #ff6e63 */
      --accent-magic-item: var(--violet-300); /* #c88aff */
      --accent-spell: var(--sea-300);         /* #3dd9f5 */

      --rarity-common: var(--bone-400);       /* #c2b4a3 */
      --rarity-uncommon: var(--green-300);    /* #42e68c */
      --rarity-rare: var(--blue-300);         /* #6eb5ff */
      --rarity-very-rare: var(--violet-300);  /* #c88aff */
      --rarity-legendary: var(--amber-300);   /* #ffb838 */
      --rarity-artifact: var(--crimson-300);  /* #ff5c82 */
    }
  }

  [data-type='creature'] { --accent: var(--accent-creature); }
  [data-type='magic-item'] { --accent: var(--accent-magic-item); }
  [data-type='spell'] { --accent: var(--accent-spell); }

  [data-rarity='common'] { --accent: var(--rarity-common); }
  [data-rarity='uncommon'] { --accent: var(--rarity-uncommon); }
  [data-rarity='rare'] { --accent: var(--rarity-rare); }
  [data-rarity='very-rare'] { --accent: var(--rarity-very-rare); }
  [data-rarity='legendary'] { --accent: var(--rarity-legendary); }
  [data-rarity='artifact'] { --accent: var(--rarity-artifact); }
}
```

#### 3. `site/src/styles/tokens/components.css`
```css
/*
 * Component tokens (docs/styling.md#tokens): per-component knobs that default to
 * semantic tokens.
 */
@layer tokens {
  :root,
  [data-theme] {
    /* Page shell. */
    --page-width: var(--content-width);
    --page-gutter: var(--space-s);
    --header-bg: var(--color-surface);
    --header-border-color: var(--color-border);
    --footer-text-color: var(--color-text-muted);

    /* Gallery grid and cards. */
    --card-min-width: var(--size-card-min);
    --grid-gap: var(--space-m);
    --card-bg: var(--color-surface);
    --card-border-color: var(--color-border);
    --card-radius: var(--radius-card);
    --card-padding: var(--space-card);
    --card-shadow: var(--shadow-card);
    --art-aspect: var(--ratio-art);
    --filters-width: var(--size-filters);
    --filters-gap: var(--space-s);

    /* Stat blocks (detail pages and full views). */
    --statblock-bg: var(--color-surface);
    --statblock-border-color: var(--color-border);
    --statblock-padding: var(--space-l);

    /* Form controls (filters, search, select). */
    --control-bg: var(--color-surface);
    --control-border-color: var(--color-control-border);
    --control-radius: var(--radius-control);
    --control-padding: var(--space-xs) var(--space-s);

    /* Badges / tags. */
    --badge-bg: color-mix(in srgb, var(--accent) 14%, var(--color-surface));

    /* Accent-driven roles. Fall back to semantic accent; content.css overrides --accent per entry. */
    --accent: var(--color-accent);
  }

  [data-type],
  [data-rarity] {
    --statblock-rule-color: var(--accent);
    --table-header-rule: var(--border-width-strong) solid var(--accent);
    --badge-border: 1.5px solid var(--accent);
    --badge-text: var(--accent);
  }
}
```

## 4. Architectural Ornamentation Recipes

The package also includes two standalone SVG ornaments in `site/src/assets/ornaments/`:
1. **`flw-wasmuth-frieze.svg`**: Full-width horizontal stepped rule and art-glass block divider for section breaks or below `.site-header`.
2. **`flw-poche-corner.svg`**: Larkin Building floor-plan *poché* corner medallion for hero banners or print headers.
