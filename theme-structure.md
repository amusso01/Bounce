# Bounce: theme structure & override guide

Bounce is built on **Horizon 4.2.0** (see `theme_info` in `config/settings_schema.json`). This file explains how Horizon is put together, where its styles and scripts come from, and how to override them without fighting the theme or making upgrades painful.

It is listed in `.shopifyignore`, so it never gets uploaded to Shopify.

---

## TL;DR

- Horizon **already prints every theme setting as a CSS custom property** on `:root` (`snippets/theme-styles-variables.liquid`, `snippets/color-palette.liquid`). You don't need the Dawn habit of writing your own `:root` block in `theme.liquid`. Map Horizon's variables into SCSS instead (`$fontSansSerif: var(--font-body--family);`).
- Our code lives in `src/`, and Parcel compiles it to `assets/bounce.css` and `assets/bounce.js`. Both are loaded **after `{{ content_for_header }}`** in `layout/theme.liquid` and `layout/password.liquid`, so they come last in `<head>` and win ties against Horizon.
- Override in this order: **Theme Editor setting → CSS variable → CSS rule in bounce.css → new `bounce-*` section/block → edit a Horizon file** (last resort, and log it in [Core edits log](#core-edits-log)).
- Horizon's JS is native ES modules plus an import map (`@theme/component`, `@theme/events`, …). Parcel **can't** bundle those imports. Components that extend Horizon's `Component` class are written as plain ES modules straight in `assets/`.

---

## 1. Folder map

| Folder | What's in it | Owner |
|---|---|---|
| `layout/` | `theme.liquid` (every page), `password.liquid` | Horizon, plus our 2-line asset include |
| `templates/` | JSON templates: which sections appear on each page type. **Written by the Theme Editor**, so treat them as content, not code | Merchant / editor |
| `sections/` | Full-width modules. Most wrap themselves with `snippets/section.liquid` | Horizon (+ ours as `bounce-*`) |
| `blocks/` | Theme blocks. `_name.liquid` = **private** block (only usable where a section/block names it explicitly). `name.liquid` = public block, accepted anywhere `"@theme"` is allowed | Horizon (+ ours as `bounce-*`) |
| `snippets/` | Render-only partials: tokens, markup helpers, `*-styles.liquid` CSS partials | Horizon (+ ours as `bounce-*`) |
| `assets/` | `base.css`, ~80 ES modules, SVG icons, **plus our compiled `bounce.css` / `bounce.js`** | Horizon + Parcel output |
| `config/` | `settings_schema.json` (editor settings) and `settings_data.json` (their values, written by the editor) | Horizon / editor |
| `locales/` | Translations (`t:` keys in schemas, `\| t` in Liquid) | Horizon |
| `src/` | **Our source**: SCSS + JS compiled by Parcel. Never uploaded (`.shopifyignore`) | Us |

Naming rule for our own files: prefix with `bounce-` (for example `sections/bounce-usp-bar.liquid`, `snippets/bounce-variables.liquid`, `assets/bounce-countdown.js`). A diff against a new Horizon release then shows at a glance which files are ours and which are core.

---

## 2. How a page renders

```
layout/theme.liquid
 ├─ <head>
 │   1. snippets/stylesheets            → assets/base.css (preloaded)
 │   2. snippets/card-hover-effect-styles
 │   3. snippets/fonts                  → font preloads
 │   4. snippets/scripts                → import map (@theme/*), module scripts, window.Theme
 │   5. snippets/theme-styles-variables → inline <style> :root { fonts, spacing, radii, … }
 │   6. snippets/color-palette          → inline <style> :root { colors, buttons, inputs, … }
 │   7. {{ content_for_header }}        → Shopify + apps + the bundled {% stylesheet %} CSS
 │   8. assets/bounce.css + bounce.js   ← OURS, last on purpose
 ├─ <body>
 │   header-group (sections/header-group.json)
 │   <main> {{ content_for_layout }}   ← templates/*.json → sections → blocks → snippets
 │   footer-group (sections/footer-group.json)
 │   cart drawer, theme drawer, search modal, quick-add modal (snippets)
```

(`layout/theme.liquid:18-39`)

**What this means for the cascade.** Shopify bundles every section/block/snippet `{% stylesheet %}` into one CSS file and injects it **through `content_for_header`**, trimmed per page to the files actually rendered ([Shopify docs](https://shopify.dev/docs/storefronts/themes/best-practices/javascript-and-stylesheet-tags)). If `bounce.css` were linked any earlier, component CSS would beat it at equal specificity. Because it loads last:

- `:root { --token: … }` in `bounce.css` overrides Horizon's inline `:root` tokens.
- `.product-card { … }` in `bounce.css` overrides the same selector from a Horizon `{% stylesheet %}`.
- Inline `{% style %}` blocks rendered inside `<body>`, and inline `style=""` attributes, still come after us or win on specificity. That's usually per-instance editor values, and you *want* those to win.

### Sections and blocks

- A typical section (`sections/section.liquid`) just captures `{% content_for 'blocks' %}` and hands it to `{% render 'section' %}` (`snippets/section.liquid`). That wrapper gives every section its background media, color override, border, spacing and layout direction. **Reuse that wrapper in our sections** to get the same editor controls for free.
- `"blocks": [{ "type": "@theme" }, { "type": "@app" }]` in a schema = accept any public theme block and app blocks.
- Static (non-removable) blocks are rendered with `{% content_for 'block', type: '_header-logo', id: 'header-logo' %}` (see `sections/header.liquid:84-96`). Those blocks need a `{% doc %}` header.
- Section/block schemas: the project skill `.claude/skills/shopify-section-schema` has the full rules.

---

## 3. Design tokens (Horizon's `:root` variables)

All of these come from Theme Editor settings or Horizon's hard-coded scale. Use them in SCSS through `var()`.

### `snippets/theme-styles-variables.liquid` (`:root` at line 126)

| Group | Examples | Driven by setting? |
|---|---|---|
| Font families | `--font-body--family`, `--font-heading--family`, `--font-subheading--family`, `--font-accent--family` (+ `--style`, `--weight`) | Yes: Typography |
| Type presets | `--font-paragraph--size`, `--font-h1--size` … `--font-h6--size`, plus `--family`, `--weight`, `--line-height`, `--letter-spacing`, `--case` for each | Yes: `type_size_h1`, `type_font_h1`, … (fluid `clamp()` above 48px) |
| Fixed type scale | `--font-size--3xs` … `--font-size--6xl` | No |
| Page widths | `--narrow-page-width` (90rem), `--normal-page-width` (120rem), `--wide-page-width` (150rem) | Chosen by `page_width` → `body.page-width-*` |
| Spacing | `--padding-3xs…6xl`, `--margin-3xs…6xl`, `--gap-3xs…3xl` | No |
| Radii / borders | `--style-border-radius-buttons-primary`, `--style-border-radius-inputs`, `--style-border-width-primary`, … | Yes: Buttons / Inputs |
| Buttons | `--button-padding-block`, `--button-padding-inline`, `--button-font-family-primary`, `--button-text-case-primary` | Partly |
| Layers | `--layer-base` … `--layer-temporary` (z-index scale) | No |
| Motion | `--animation-speed`, `--ease-out-cubic`, `--spring-d300-b0-easing`, … | No |
| Icons | `--icon-size-*`, `--icon-stroke-width` | `icon_stroke` |

### `snippets/color-palette.liquid` (`:root` at line 167)

| Group | Examples |
|---|---|
| Page | `--color-background`, `--color-foreground`, `--color-border`, each with an `-rgb` twin (`--color-foreground-rgb`) |
| Palette extremes | `--palette-lightest`, `--palette-darkest` (used for auto contrast) |
| Buttons | `--color-primary-button-{text,background,border,hover-*}`, same for `secondary` |
| Inputs / variants | `--color-input-*`, `--color-variant-*`, `--color-selected-variant-*` |
| Derived | `--color-foreground-muted`, `--color-foreground-subdued`, `--opacity-*` |

Horizon 4.2 uses a **color palette** (`settings.color_palette`) plus per-section background colors. It doesn't use Dawn-style color schemes.

### Per-section color scope

When a section or block has a custom background color, `snippets/contrast-override.liquid` prints a scoped rule, `.color-custom-{section_id} { --color-background: …; --color-foreground: …; }`, and works out a readable text color automatically. So **always use `var(--color-foreground)` / `var(--color-background)` rather than hard-coded colors**, and your component recolors correctly inside any section.

> **Sass + CSS variables gotcha.** Sass color functions (`darken()`, `rgba($var, .5)`, `color.adjust`) can't read `var()` at build time. Use the `-rgb` twins or `color-mix()` instead:
> `rgb(var(--color-foreground-rgb) / 0.5)` or `color-mix(in srgb, var(--color-foreground) 50%, transparent)`.

---

## 4. CSS architecture

| Layer | Where | Notes |
|---|---|---|
| Global base | `assets/base.css` (~1.8k lines) | Reset (`box-sizing`, `img/svg { display:block }`), layout grid, typography presets (line 594+), buttons (`.button`, `.button-secondary`, line 802+), RTE (line 1279+), animations |
| Component CSS | `{% stylesheet %}` in sections/blocks/snippets (~150 files) | **No Liquid inside**, one per file, bundled via `content_for_header`. Many live in `snippets/*-styles.liquid` |
| Per-instance CSS | `{% style %}` or `style=""` | Liquid allowed. Used for editor values (sizes, colors per block) |
| **Ours** | `src/bounce.scss` → `assets/bounce.css` | Loaded last (see §2) |

**Breakpoints.** Horizon uses `750px` almost everywhere (`min-width: 750px` / `max-width: 749px`, about 330 uses), then `990px`, `1200px`, `1400px`. Our include-media map in `src/scss/base/_media.scss` currently uses 480/768/1024/1440, so it's worth aligning (see [Bundler review](#9-bundler--src-review)):

```scss
$breakpoints: (
	'mobile': 750px,  // Horizon's mobile/desktop switch
	'tablet': 990px,
	'desktop': 1200px,
	'wide': 1400px,
);
```

Horizon writes modern CSS (native nesting, `:has()`, `@media` inside rules), so plain CSS inside `{% stylesheet %}` is perfectly viable for small components. Save SCSS for code that benefits from mixins or the shared token layer.

---

## 5. JS architecture

- **Import map** (`snippets/scripts.liquid`): bare names such as `@theme/component`, `@theme/events`, `@theme/utilities`, `@theme/section-renderer`, `@theme/morph` point to files in `assets/`. Scripts load as `type="module"`, most with `fetchpriority="low"`.
- **`Component` base class** (`assets/component.js`). Every Horizon widget is a custom element extending it:
  - `ref="name"` / `ref="items[]"` on children → `this.refs.name` / `this.refs.items` (kept up to date by a MutationObserver). `requiredRefs = ['name']` throws if one is missing.
  - Declarative events: `on:click="/method"` calls `method(event)` on the closest `*-component` ancestor. `on:click="some-selector/method"` targets `closest(selector)`, `on:click="#id/method"` targets an element by id, and a trailing `/data` or `?data` segment is passed as the first argument. Supported events: click, change, select, focus, blur, submit, input, keydown, keyup, toggle, pointerdown, pointerenter, pointerleave.
- **Section re-rendering**: `@theme/section-renderer` + `@theme/morph` swap section HTML in place (cart, filters, variants). Custom elements re-run `connectedCallback` on new DOM, **so you don't need MutationObserver helpers like `arrive`**.
- **Globals**: `window.Theme` (`routes`, `translations`, `template.name`) is defined inline in `snippets/scripts.liquid`.
- **Events**: theme events live in `assets/events.js` (`ThemeEvents.quantitySelectorUpdate`, `ThemeEvents.cartSectionRestored`, `SlideshowSelectEvent`, …). Cart actions go through Shopify's standard actions/events (`window.Shopify.actions`, `@shopify/events`). Horizon's hooks are in `assets/standard-actions-override.js`, and the typed payloads are in `assets/standard-events.d.ts`.
- `{% javascript %}` is used only once (`sections/main-collection.liquid`). Horizon prefers module files in `assets/`.

---

## 6. Dawn → Horizon: the variable pattern

In Dawn you printed Liquid values into `:root` in `theme.liquid`, then mapped them in `_variable.scss`. In Horizon:

| You need… | Do this |
|---|---|
| A value that's **already a theme setting** (fonts, sizes, button colors, radii…) | It's already a CSS variable. Map it in `src/scss/base/_variable.scss`, e.g. `$fontHeading: var(--font-heading--family);` |
| A **new merchant-editable value** | Add a setting to `config/settings_schema.json`, print it in `snippets/bounce-variables.liquid`, render that snippet right after `color-palette` in both layouts, then map it in `_variable.scss` |
| A **fixed brand value** that merchants never change | A plain SCSS variable, or a `:root { --bounce-… }` custom property in `bounce.css` |

`_variable.scss` already maps the Horizon font families and page colors (`$fontSansSerif`, `$fontHeading`, `$fontSubheading`, `$fontAccent`, `$colorBackground`, `$colorForeground`).

Example: a merchant-editable accent color.

```jsonc
// config/settings_schema.json: add a group at the end
{
  "name": "Bounce",
  "settings": [
    { "type": "color", "id": "bounce_accent", "label": "Accent color", "default": "#ffc629" }
  ]
}
```

```liquid
{%- comment -%} snippets/bounce-variables.liquid {%- endcomment -%}
{% style %}
  :root {
    --bounce-accent: {{ settings.bounce_accent }};
    --bounce-accent-rgb: {{ settings.bounce_accent.rgb }};
  }
{% endstyle %}
```

```liquid
{%- comment -%} layout/theme.liquid + layout/password.liquid, right after render 'color-palette' {%- endcomment -%}
{%- render 'bounce-variables' -%}
```

```scss
// src/scss/base/_variable.scss
$colorAccent: var(--bounce-accent);
// ::selection { background: $colorAccent; }
```

Use `{% style %}` (Liquid allowed, live-updates in the editor), not `{% stylesheet %}` (no Liquid).

---

## 7. Override recipes

### The ladder (try the top one first)

1. **Theme Editor setting**: fonts, sizes, button radius, colors. No code, and the merchant keeps control.
2. **Override a CSS variable**, globally (`:root`) or scoped (`.product-card { … }`). One line, and it flows into every Horizon rule that uses it.
3. **Add a CSS rule in `bounce.css`** targeting Horizon's classes. It loads last, so equal specificity is enough.
4. **Create a `bounce-*` section/block/snippet**, copying a Horizon one as a starting point, instead of editing the original.
5. **Edit a Horizon core file.** Last resort. Keep the change small and add it to the [Core edits log](#core-edits-log).

### Change a design token globally

```scss
// src/scss/base/_tokens.scss  (new partial; add `@use './scss/base/tokens';` to src/bounce.scss)
:root {
	--style-border-radius-md: 0;
	--font-heading--spacing: 0.4em;
	--button-padding-inline: 2rem;
}
```

⚠️ Overriding a **setting-driven** token (for example `--font-h1--size`) makes that editor setting do nothing. Do it only when you mean to lock the design. Otherwise change the setting.

### Scope a token to one component

```scss
.product-card {
	--button-padding-inline: 12px;
	--font-paragraph--size: 0.875rem;
}
```

### Restyle Horizon buttons

Horizon buttons are `.button` / `.button-secondary` (not `.btn`), sized by `--button-padding-block` / `--button-padding-inline`:

```scss
.button,
.button-secondary {
	--button-padding-block: #{$btnPaddingY};
	--button-padding-inline: #{$btnPaddingX};
	font-size: $btnFontSize;
	line-height: $btnLineHeight;
	letter-spacing: $btnLetterSpacing;
}
```

### Style a single section type

Sections get a `.shopify-section` wrapper (`#shopify-section-{{ section.id }}`) plus whatever `"class"` their schema declares (for example `sections/section.liquid` → `section-wrapper`). For our own sections, give the schema a class such as `"class": "bounce-usp-bar"` and target that. For small components, put the CSS in the section's `{% stylesheet %}`. For larger ones, use a partial in `src/scss/sections/`.

### New section that behaves like Horizon's

```liquid
{%- comment -%} sections/bounce-usp-bar.liquid {%- endcomment -%}
{% capture children %}
  {% content_for 'blocks' %}
{% endcapture %}

{% render 'section',
  section: section,
  children: children,
  section_id: section.id,
  background_color: section.settings.background_color
%}

{% schema %}
{
  "name": "USP bar",
  "class": "bounce-usp-bar",
  "blocks": [{ "type": "@theme" }, { "type": "@app" }],
  "settings": [ /* copy the layout, color and spacing settings you need from sections/section.liquid */ ],
  "presets": [{ "name": "USP bar" }]
}
{% endschema %}
```

### A JS component that plugs into Horizon

Write it as a native module in `assets/` (**not** in `src/`, because Parcel can't resolve `@theme/*`):

```js
// assets/bounce-countdown.js
import { Component } from '@theme/component';

class BounceCountdownComponent extends Component {
	requiredRefs = ['label'];

	connectedCallback() {
		super.connectedCallback();
		this.refs.label.textContent = 'Ready';
	}

	reset() {
		this.refs.label.textContent = 'Reset!';
	}
}

if (!customElements.get('bounce-countdown-component')) {
	customElements.define('bounce-countdown-component', BounceCountdownComponent);
}
```

```liquid
<bounce-countdown-component>
  <span ref="label"></span>
  <button type="button" on:click="/reset">Reset</button>
</bounce-countdown-component>

<script src="{{ 'bounce-countdown.js' | asset_url }}" type="module"></script>
```

End the tag name in `-component` so `on:*` attributes find it. Add it to the import map in `snippets/scripts.liquid` only if other modules need to `import` it by name.

### Global JS and npm packages (Parcel lane)

`src/bounce.js` → `assets/bounce.js` is for site-wide code and npm libraries that don't need Horizon's modules. Talk to Horizon through the DOM and events (`document.addEventListener(ThemeEvents.…)` by string name, `window.Theme`), not through imports.

For a heavy library used by only one section (Swiper, for example), add a **separate Parcel entry** and load it only in that section:

```jsonc
// package.json: add the entry to dev and build
"build": "parcel build src/bounce.js src/bounce.scss src/bounce-slider.js --dist-dir assets …"
```

```liquid
<script src="{{ 'bounce-slider.js' | asset_url }}" defer></script>
```

Keep entries **directly in `src/`**. Parcel mirrors entry subfolders into the output (`src/js/x.js` → `assets/js/x.js`), and Shopify's `assets/` can't hold subfolders.

---

## 8. Build pipeline

```
src/bounce.scss ──┐                              ┌─ assets/bounce.css ─┐
                  ├─ Parcel (sass, lightningcss, ┤                     ├─ layout/theme.liquid (after content_for_header)
src/bounce.js ────┘   SWC/Babel, minify)         └─ assets/bounce.js ──┘  layout/password.liquid
```

| Command | What it does |
|---|---|
| `pnpm dev` | `parcel watch` → rewrites `assets/bounce.*` on save |
| `shopify theme dev --store <store>` (second terminal) | Syncs `assets/` to a dev theme with hot reload, so it picks up Parcel's output |
| `pnpm build` | Production build (minified, no source maps). **Run before committing or pushing.** Compiled `assets/bounce.*` must be committed if you deploy through Shopify's GitHub integration |
| `pnpm clean` | Removes `.parcel-cache` |

Notes:

- pnpm 10 skips dependency build scripts (`@parcel/watcher`, `@swc/core`, `lmdb`). The prebuilt binaries work (the build passes), but if `pnpm dev` ever fails to watch, run `pnpm approve-builds`.
- `include-media` 2.0 prints Sass `if()` deprecation warnings from its own source during the build. Harmless; it's upstream.
- **Check in the browser:** with `shopify theme dev` running, open DevTools → Elements → `<head>` and confirm `bounce.css` is the last stylesheet, after the compiled `styles.css` that `content_for_header` injects.

---

## 9. Bundler & `src/` review

The Parcel setup was copied from another project (package name `crashbaggage`, repo `Ground-Control`). Findings, most important first:

| # | Finding | Impact | Status / fix |
|---|---|---|---|
| 1 | `assets/bounce.css` / `bounce.js` were never loaded by any layout | Nothing we wrote reached the storefront | **Fixed.** Linked after `{{ content_for_header }}` in `layout/theme.liquid` and `layout/password.liquid` |
| 2 | `$fontSansSerif` used in `_base.scss` and `_btn.scss` but never defined | Sass build failed | **Fixed.** `_variable.scss` now maps Horizon's font/color variables |
| 3 | ⚠️ `_reset.scss` sets `* { margin: 0; padding: 0 }`. The rest of the file duplicates `assets/base.css` (box-sizing, `img/svg` display, `font: inherit`) | **Now live, since #1.** It removes the browser's default `p`/heading margins and list indentation. Horizon keeps those defaults and only trims the first/last child (`base.css:147-156`), so paragraphs in text blocks lose their spacing | Open. Delete `_reset.scss` and its `@use`; Horizon's base.css already resets what it needs |
| 4 | ⚠️ `_base.scss` hard-codes `h1–h4` sizes (70/50/40/30px) and forces the **body** font plus weight 700 on all headings | **Now live, since #1.** Overrides the Typography settings: editor changes to heading font/size do nothing (current data: H1 = 56px, heading font Inter 700) | Open. Remove those rules. Set sizes and fonts in the editor, or lock them via tokens (`:root { --font-h1--size: … }`) |
| 5 | `_btn.scss` targets `.btn` and sets `--top-bottom-padding` / `--left-right-padding` (Dawn names) | No effect: Horizon markup has no `.btn`, and its buttons read `--button-padding-block/inline` | Open. Rewrite as in [Restyle Horizon buttons](#restyle-horizon-buttons) |
| 6 | include-media breakpoints 480/768/1024/1440 vs Horizon's 750/990/1200/1400 | Our layout switches at different widths than Horizon's (e.g. 750–767px) | Open. Use the map in §4 |
| 7 | No `browserslist` | lightningcss outputs the newest syntax: the build emits `@media (width<=767px)` range queries (Safari 16.4+) | Open. Add `"browserslist": "defaults and supports es6-module"` to `package.json` |
| 8 | `.babelrc` with only `@babel/preset-env` | Parcel warns on every build: it forces Babel (slower) and ignores Parcel's targets | Open. Delete `.babelrc` and the `@babel/*` packages. Parcel's built-in SWC transpiles using `browserslist` |
| 9 | `minify-js` runs `terser` after `parcel build` | Parcel already minifies, so this is a redundant second pass | Open. Drop the script and `terser` |
| 10 | No `--public-url ./` | Parcel defaults to `/`, so any `url()` asset or code-split chunk would point at the store root, not the CDN `assets/` path. Parcel also never cleans `assets/`, so hashed files would pile up | Open. Add `--public-url ./`. Prefer referencing images and fonts from Liquid (`asset_url`) over `url()` in SCSS |
| 11 | `parcel watch` writes `.map` files into `assets/` | `shopify theme dev` uploads them to the dev theme; stale ones can linger | Open. Add `--no-source-maps` to `dev`, or `assets/*.map` to `.shopifyignore` |
| 12 | Dawn-era dependencies: `arrive`, `accordion-js`, `swiper`, `buffer`, `process` | `arrive` makes up most of today's 5.7 kB `bounce.js`, but custom elements already cover it; Horizon has `accordion-custom` and its own slideshow; `buffer`/`process` are unused Parcel polyfills | Open. Remove them; add `swiper` back only for a section that needs it, as its own entry (§7) |
| 13 | `parcel` and `@babel/preset-env` sit in `dependencies`; name/repo/author are from the old project | Cosmetic | Open. Move to `devDependencies`, rename to `bounce` |
| 14 | `.gitignore` ignores `pnpm-lock.yaml`, `.babelrc`, `.parcelrc`, `README.md` | Teammates get unpinned installs and a different build | Open. Commit the lockfile and build config |
| 15 | Project isn't a git repo yet | Nothing to diff when Horizon ships an update | Open. `git init` and commit untouched Horizon 4.2.0 **first**, then our changes |
| 16 | `src/bounce.js` imports `test.js` (logs "Hello World") | Console noise on the storefront | Open. Remove it |

Checked and fine: the `~include-media/…` path resolves in Parcel, and forwarding include-media `with ($breakpoints: …)` while `_media.scss` also declares `$breakpoints` compiles without conflict.

### Suggested `package.json` (not applied yet)

```json
{
	"name": "bounce",
	"private": true,
	"browserslist": "defaults and supports es6-module",
	"scripts": {
		"dev": "parcel watch src/bounce.js src/bounce.scss --dist-dir assets --public-url ./ --no-source-maps",
		"build": "parcel build src/bounce.js src/bounce.scss --dist-dir assets --public-url ./ --no-source-maps",
		"clean": "rm -rf .parcel-cache"
	},
	"devDependencies": {
		"@parcel/transformer-sass": "2.16.4",
		"include-media": "^2.0.0",
		"parcel": "^2.16.4",
		"sass": "^1.102.0"
	}
}
```

After changing it: `rm .babelrc && pnpm install && rm -rf .parcel-cache && pnpm build`.

---

## 10. Upgrading Horizon

1. Keep a git baseline of vanilla Horizon (see #15 above).
2. When Horizon releases a new version, download it into a branch, diff it against the baseline, and merge. Files prefixed `bounce-` and everything in `src/` are ours and won't conflict.
3. Files listed in the Core edits log are the only ones that need a manual merge.
4. `templates/*.json`, `sections/*-group.json` and `config/settings_data.json` are editor content. Take them from the live theme, not from the Horizon release.

### Core edits log

Every Horizon file we've changed, and why:

| File | Change | Why |
|---|---|---|
| `layout/theme.liquid` | Added `bounce.css` / `bounce.js` after `{{ content_for_header }}` | Load our build last so it wins the cascade |
| `layout/password.liquid` | Same as above | Same, for the password page |
