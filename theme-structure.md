# Bounce: theme structure & override guide

Bounce is built on **Horizon 4.2.0** (see `theme_info` in `config/settings_schema.json`). This file explains how Horizon is put together, where its styles and scripts come from, and how to override them without fighting the theme or making upgrades painful.

It is listed in `.shopifyignore`, so it never gets uploaded to Shopify.

---

## TL;DR

- Horizon **already prints every theme setting as a CSS custom property** on `:root` (`snippets/theme-styles-variables.liquid`, `snippets/color-palette.liquid`). You don't need the Dawn habit of writing your own `:root` block in `theme.liquid`. Map Horizon's variables into SCSS instead (`$fontSansSerif: var(--font-body--family);`).
- Our code lives in `src/`, and Parcel compiles it to `assets/bounce.css` and `assets/bounce.js`. Both are loaded **after `{{ content_for_header }}`** in `layout/theme.liquid` and `layout/password.liquid`, so they come last in `<head>` and win ties against Horizon.
- Override in this order: **Theme Editor setting → CSS variable → CSS rule in bounce.css → new `bounce-*` section/block → edit a Horizon file** (last resort, and log it in [Core edits log](#core-edits-log)).
- Our JS works like it did in Dawn: site code and npm packages (`arrive`, `swiper`, `accordion-js`, `gsap`, `lenis`) go through Parcel into `assets/bounce.js`, and it talks to Horizon through the DOM. Horizon's own modules (`@theme/*`) can't be imported from the bundle. That only matters if you want to extend Horizon's classes (§7).
- Before writing JS, read [Things that differ from Dawn](#things-that-differ-from-dawn): Horizon patches sections in place instead of replacing them, and on desktop the page scrolls inside `.page-wrapper`, not the window.

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
 │   3. snippets/fonts                  → font preloads (skipped for system fonts)
 │      snippets/bounce-fonts           ← OURS: Simplon Mono @font-face + preload
 │   4. snippets/scripts                → import map (@theme/*), module scripts, window.Theme
 │   5. snippets/theme-styles-variables → inline <style> :root { fonts, spacing, radii, … }
 │   6. snippets/color-palette          → inline <style> :root { colors, buttons, inputs, … }
 │      snippets/bounce-colors          ← OURS: --bounce-color-1..4 from the palette
 │   7. {{ content_for_header }}        → Shopify + apps + the bundled {% stylesheet %} CSS
 │   8. assets/bounce.css + bounce.js   ← OURS, last on purpose
 ├─ <body>
 │   header-group (sections/header-group.json)
 │   <main> {{ content_for_layout }}   ← templates/*.json → sections → blocks → snippets
 │   footer-group (sections/footer-group.json)
 │   cart drawer, theme drawer, search modal, quick-add modal (snippets)
```

(`layout/theme.liquid:18-40`)

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
| Font families | `--font-body--family`, `--font-heading--family`, `--font-subheading--family`, `--font-accent--family` (+ `--style`, `--weight`) | **Overridden by us**: all four are Simplon Mono with fixed weights (see [Custom font](#custom-font-simplon-mono)) |
| Type presets | `--font-paragraph--size`, `--font-h1--size` … `--font-h6--size`, plus `--family`, `--weight`, `--line-height`, `--letter-spacing`, `--case` for each | Yes: `type_size_h1`, `type_font_h1`, … (fluid `clamp()` above 48px) |
| Fixed type scale | `--font-size--3xs` … `--font-size--6xl` | No |
| Page widths | `--narrow-page-width`, `--normal-page-width`, `--wide-page-width` (Horizon: 1440 / 1920 / 2400px) | **Overridden by us** to 1024 / 1120 / 1440px (see [Content widths](#content-widths)). `page_width` setting picks one → `body.page-width-*` |
| Spacing | `--padding-3xs…6xl`, `--margin-3xs…6xl`, `--gap-3xs…3xl` | No |
| Radii / borders | `--style-border-radius-buttons-primary`, `--style-border-radius-inputs`, `--style-border-width-primary`, … | Yes: Buttons / Inputs |
| Buttons | `--button-padding-block`, `--button-padding-inline`, `--button-font-family-primary`, `--button-text-case-primary` | Partly |
| Layers | `--layer-base` … `--layer-temporary` (z-index scale) | No |
| Motion | `--animation-speed`, `--ease-out-cubic`, `--spring-d300-b0-easing`, … | No |
| Icons | `--icon-size-*`, `--icon-stroke-width` | `icon_stroke` |

### `snippets/color-palette.liquid` (`:root` at line 192)

| Group | Examples |
|---|---|
| Page | `--color-background`, `--color-foreground`, `--color-border`, each with an `-rgb` twin (`--color-foreground-rgb`) |
| Palette extremes | `--palette-lightest`, `--palette-darkest` (used for auto contrast) |
| Buttons | `--color-primary-button-{text,background,border,hover-*}`, same for `secondary` |
| Inputs / variants | `--color-input-*`, `--color-variant-*`, `--color-selected-variant-*` |
| Derived | `--color-foreground-muted`, `--color-foreground-subdued`, `--opacity-*` |
| Selection | `--selection-background` on `:root`, and again on buttons, inputs and selected variant labels (see [Text selection](#text-selection)) |

Horizon 4.2 uses a **color palette** (`settings.color_palette`) plus per-section background colors. It doesn't use Dawn-style color schemes.

### Per-section color scope

When a section or block has a custom background color, `snippets/contrast-override.liquid` prints a scoped rule, `.color-custom-{section_id} { --color-background: …; --color-foreground: …; }`, and works out a readable text color automatically. The same rule sets `--selection-background` from that text color. So **always use `var(--color-foreground)` / `var(--color-background)` rather than hard-coded colors**, and your component recolors correctly inside any section.

### Text selection

`::selection` cannot read an element's text color, so the highlight is a custom property set beside the text color. Do not hard-code `::selection { background: #000 }` again: black text on a black highlight disappears.

`src/scss/base/_base.scss` keeps `::selection` and `::-moz-selection` as separate rules (grouping them drops the rule in browsers that don't know one of the pseudos). Both are:

```scss
background: var(--selection-background, #{$color3});
```

`$color3` is palette **color1** (pink), printed as `--bounce-color-3` by `snippets/bounce-colors.liquid`. The selected text color is left alone; only the highlight background changes.

`snippets/util-selection-background.liquid` picks that background from a text color. Shopify `color_brightness` of **200 or higher** (white is 255) returns `#000000`. Anything else returns `settings.color_palette.color1`.

| Surface | Where `--selection-background` is set | Text color it follows |
|---|---|---|
| Page | `snippets/color-palette.liquid` on `:root` | `settings.page_text_color` (black today, so the highlight is pink) |
| Primary buttons | same file: `.button`, `.button-custom`, unbranded payment button, including `:hover` | primary button text / hover text |
| Secondary buttons | same file: `.button-secondary`, including `:hover` | secondary button text / hover text |
| Inputs | same file: `input`, `textarea`, `select` | input text |
| Selected variant | same file: `.variant-option__button-label:has(:checked)`, including `:hover` | selected variant text / hover text |
| Custom section or block color | `snippets/contrast-override.liquid` on `.color-custom-{id}`, next to `--color-foreground` | the effective text color. An explicit text color uses its brightness. The dark-background fallback (`var(--palette-lightest)`) is treated as white, so that highlight stays black |
| Marquee | `.bounce-marquee` in `src/scss/sections/_marquee.scss` | white text, but the bar is already `#000`, so the highlight is `$color3`. A black highlight would match the bar and disappear |
| On-media slideshow controls | `snippets/slideshow-controls.liquid` | forced `#000`. The text is hardcoded white and sits on a photo, not a black fill |

A button, input or selected variant sets its own variable, so it wins over a section's. Button text is independent of the section foreground.

When you add white text that doesn't go through those tokens, set `--selection-background: #000` on that element. If that element's own background is already black, use `$color3` instead, or the highlight matches the surface and disappears. Otherwise the pink fallback sits on white type.

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

**Breakpoints.** Horizon uses `750px` almost everywhere (`min-width: 750px` / `max-width: 749px`, about 330 uses), then `990px`, `1200px`, `1400px`. Our include-media map in `src/scss/base/_media.scss` matches them:

```scss
$breakpoints: (
	// 'mobile' is Horizon's mobile/desktop switch
	'mobile': 750px,
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
- **Section re-rendering**: `@theme/section-renderer` + `@theme/morph` update the cart, filters, variants and more by **patching the existing DOM** rather than replacing it (see below).
- **Globals**: `window.Theme` (`routes`, `translations`, `template.name`) is defined inline in `snippets/scripts.liquid`.
- **Events**: theme events live in `assets/events.js` (`ThemeEvents.quantitySelectorUpdate`, `ThemeEvents.cartSectionRestored`, `SlideshowSelectEvent`, …). Cart actions go through Shopify's standard actions/events (`window.Shopify.actions`, `@shopify/events`). Horizon's hooks are in `assets/standard-actions-override.js`, and the typed payloads are in `assets/standard-events.d.ts`.
- `{% javascript %}` is used only once (`sections/main-collection.liquid`). Horizon prefers module files in `assets/`.

### Things that differ from Dawn

Our bundle (`assets/bounce.js`) is a normal deferred script that runs after Horizon's modules, the same setup as in Dawn. Four Horizon behaviours can still catch you out. Code examples are in [§7](#js-our-parcel-bundle).

1. **Horizon patches sections in place.** When Horizon updates an area, it copies the server's fresh HTML onto the existing elements (`assets/morph.js`) instead of swapping them out. That covers the cart (`component-cart-items.js`), collection grid and filters (`facets.js`, `paginated-list.js`), search (`predictive-search.js`), product info on variant change (`variant-picker.js`, `product-form.js`, `sticky-add-to-cart.js`), quick add (`quick-add.js`), product cards (`product-card.js`) and recommendations (`product-recommendations.js`).
   - Classes and attributes your JS adds inside those areas are reset to the server's version, e.g. Swiper's classes or an `is-open` flag. Only a short list of Horizon's own attributes survives (`morph.js:13-26`).
   - `arrive` doesn't fire for patched elements, because they aren't new. It still fires for genuinely new ones, like a new cart line.
   - Horizon's opt-out, `data-skip-node-update` on an element, only protects that element's own attributes. Its children are still patched (`morph.js:258`).
   - **So:** mount Swiper, accordions and similar widgets in our own `bounce-*` sections. Inside Horizon's areas, re-initialise after they update, or keep the state in server-rendered markup.
   - As in Dawn, the Theme Editor re-renders a section when its settings change. Destroy widget instances on `shopify:section:unload`.
2. **On desktop, the window doesn't scroll.** At 990px and wider, `html` and `body` get `overflow: hidden` and `.page-wrapper` becomes the scroll container (`base.css:28-57`). `window.scrollY` stays `0` and `window` scroll events never fire; on mobile the window scrolls as usual. Listen on both, or use `IntersectionObserver`, which works in either case.
3. **Horizon's components may not be ready when our script runs.** Its modules load with `fetchpriority="low"`. Before calling a method on one of its elements, `await customElements.whenDefined('<tag-name>')`.
4. **Source maps stay in `assets/`.** `pnpm dev` writes `bounce.js.map` / `bounce.css.map` there on purpose, for debugging on the dev theme. `pnpm build` deletes them before building, and `.gitignore` excludes `assets/*.map`, so they never go into git or reach the store through the GitHub integration. `shopify theme dev` still uploads them to your dev theme. Always run `pnpm build` before committing, or the store gets the unminified dev files.

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

### Content widths

The XD design caps content at **1120px**, with a narrow and a wide variant. These are content widths; the gutters sit outside them, as in Horizon.

| Measure | SCSS variable (`_variable.scss`) | Horizon token it sets | Class |
|---|---|---|---|
| Normal, 1120px | `$contentMax` | `--normal-page-width` | `.content-max` |
| Narrow, 1024px | `$contentMaxNarrow` | `--narrow-page-width` | `.content-max--narrow` |
| Wide, 1440px | `$contentMaxWide` | `--wide-page-width` | `.content-max--wide` |

Gutters: `.content-block` adds Horizon's `--page-margin` on the sides only (16px, 40px from 750px up, wider on notched phones). It has no top or bottom padding.

**How it plugs into Horizon.** `src/scss/base/_layout.scss` overrides the three `--*-page-width` tokens. Theme settings → Page width (keep it on **Normal**) and every Horizon section, including the header and footer, therefore use our measures. Sections are a 3-column grid (`margin | content | margin`, `base.css:303-340`), so backgrounds stay full-bleed while content stops at 1120px.

**Which one to use:**

- **Our own markup outside Horizon's section grid**, or inside a full-width section:
  ```html
  <div class="content-block">
    <div class="content-max">…</div>   <!-- or content-max--narrow / content-max--wide -->
  </div>
  ```
- **A whole section narrow or wide.** Inside a normal Horizon section the content column is already capped at 1120px, so `.content-max--wide` can't grow past it. Put Horizon's own class on the section wrapper instead, e.g. in a `bounce-*` section schema: `"class": "page-width-wide"`. It re-points `--page-width` for everything inside and keeps the full-bleed background. `page-width-narrow` works the same way.

**Known trade-off.** A few Horizon files are hard-coded for its stock widths:
- `sections/main-blog.liquid` pins the blog grid to the narrow token, so it's now 1024px.
- Image `sizes` in `snippets/util-product-media-sizes-attr.liquid`, `snippets/util-mega-menu-img-sizes-attr.liquid`, `snippets/background-media.liquid` and `sections/main-blog.liquid` still assume 1440/1920/2400px. They overestimate, so on wide screens browsers may download larger images than needed.

Nothing breaks. Aligning them would be a core edit, so it's left for later.

### Custom font (Simplon Mono)

Every font role (body, subheading, heading, accent) uses **Simplon Mono**, whatever Theme settings → Typography says:

| Piece | Where |
|---|---|
| Font files | `assets/SimplonMono-{Light,LightItalic,Regular,RegularItalic,Medium,MediumItalic,Bold,BoldItalic}.{woff2,woff}`. Added straight to `assets/`; Parcel isn't involved |
| `@font-face` rules + preload | `snippets/bounce-fonts.liquid`, rendered right after `snippets/fonts` in both layouts. Liquid is needed here for `asset_url`, which also adds `?v=` so updated files bust the cache. Only `Regular.woff2` is preloaded, since weight 400 covers body, heading and accent |
| Override of Horizon's font variables | `src/scss/base/_fonts.scss` (in `bounce.css`) sets `--font-{body,subheading,heading,accent}--family` to `$fontSimplonMono`. It also locks the weights: body 400, subheading 300, heading 400, accent 400 |
| Fallback stack | `$fontSimplonMono` in `_variable.scss`: `'Simplon Mono', ui-monospace, Menlo, Consolas, monospace` |

Everything else follows automatically: the `h1–h6` presets (`--font-h1--family: var(--font-heading--family)`), buttons, cart, badges and the text block's font setting. The italic and bold faces are picked by the browser for `<em>` / `<strong>`.

Two things outside the variables:

- **Theme Editor:** set all four font pickers to the system **Mono** font. `snippets/fonts.liquid` skips preloading system fonts, so Horizon stops downloading the web fonts it would otherwise fetch (Inter today) for nothing.
- **Account label:** `snippets/header-actions.liquid` writes the picker's font inline on `<shopify-account>`. `_fonts.scss` overrides it with `!important`.

To change weights later, edit the `--font-*--weight` values in `_fonts.scss`. Weights 300/400/500/700 exist; anything in between snaps to the nearest face.

### Button component

Horizon buttons are `.button` (primary), `.button-secondary` and `.button-custom` (not `.btn`). Use those classes for any new button, and it picks up the design spec from `src/scss/components/_btn.scss`:

| Property | Value | Where it comes from |
|---|---|---|
| Font | Simplon Mono | Theme settings → Buttons → Font (body), locked by `_fonts.scss` |
| Size / weight / line height | 16px / 400 / 22px | `_btn.scss`: `--font-paragraph--size/--weight/--line-height` set on the button itself |
| Padding | 11px top/bottom, 24px left/right | `_btn.scss`: `--button-padding-block` / `--button-padding-inline` on `:root` |
| Colors, radius, border width, text case | Black / white, 12px, 0, none | Theme settings → Buttons |

Horizon has no setting for button size, weight, line height or padding: the type follows the paragraph preset, and the padding is hardcoded (16px / 24px in `snippets/theme-styles-variables.liquid`).

`_btn.scss` changes the tokens that the `.button` rule in `base.css` reads, never `font-size` or `padding` directly. `bounce.css` loads last, so a direct `.button { font-size: … }` would also override the Horizon rules that size a particular button on purpose. Those buttons keep their own values: cart checkout, empty-cart button, sticky add to cart, facets "See results", and the `.button-unstyled` icon buttons (padding 0).

### Header

The design has the logo on the left, then the menu, an `IT | EN` language switcher and an **Acquista** button on the right. Menu position and search are editor settings (Header → Menu → Position: right; Search icon: off). Everything else:

| Piece | Where |
|---|---|
| `IT \| EN` switcher | `snippets/bounce-language-switcher.liquid`, rendered by `sections/header.liquid` (desktop) and `snippets/header-drawer.liquid` (mobile drawer). One submit button per published language in a `{% form 'localization' %}`: Shopify reloads the current page in that language, with no JS. The current language has `aria-current="true"`; the other is dimmed |
| Button | Header → **Button**: *Label* and *Link*, rendered by `snippets/bounce-buy-button.liquid` (shared with the footer). A blank label falls back to the storefront translation `bounce.buy_button` (`Acquista` in `locales/it.json`, `Buy now` in `locales/en.default.json`). Hidden until a link is set, and hidden below 750px and when the menu collapses into the drawer. Size and type come from the [Button component](#button-component) |
| Account / cart icons | Header → *Customer account* → **Account icon**, and Header → *Cart* → **Cart icon**. Both are off. When on, they sit between the switcher and the button |
| Styles and spacing | `src/scss/sections/_header.scss`. Menu links are always full strength and underline on hover. `--bounce-header-gap` spaces the menu links, switcher and button: `$navGap` (72px) from 990px up, `$navGapCompact` (32px) below. Those and the 16px / 22px nav type (`$navFontSize`, `$navLineHeight`) live in `_variable.scss`, shared with the footer |

The switcher only shows when at least two languages are published (Settings → Languages): Horizon's guard, kept on purpose. Horizon's *Country/region* and *Flag* settings are removed; the unused dropdown CSS stays in `sections/header.liquid` to keep the diff small.

With the cart icon off, add to cart still opens the cart drawer (`auto_open_cart_drawer`), and the fly-to-cart animation just skips, because it has no icon to fly to.

### Footer

`sections/bounce-footer.liquid` replaces Horizon's `sections/footer.liquid` in `sections/footer-group.json`. Horizon's file is untouched, just unused. Same layout as the header: the logo on the left; the menu, `IT | EN` and the Acquista button on the right.

It has **no blocks on purpose**. A section schema without `blocks` shows no "Add block" in the editor (Horizon's header works the same way), so the footer can't drift from the design. Everything is a section setting:

| Setting group | Settings |
|---|---|
| Logo | *Use inverse logo* (on). The image and height come from Theme settings → Logo, the same heights as the header logo |
| Menu | *Menu* (link list, `main-menu`) |
| Localization | *Language selector* on/off. Same switcher as the header (`bounce-language-switcher`), same guard (needs 2 published languages) |
| Button | *Label* and *Link*, the same as the header's (`bounce-buy-button`, blank label → Acquista / Buy now) |
| Colors | *Background* (black) and *Text* (white), applied through Horizon's `contrast-override` |
| Padding | Top / bottom, 80px |

Styles are in `src/scss/sections/_footer.scss`:

- Links, switcher and button use the header's nav values (16px / 400 / 22px, 72px apart) from `_variable.scss`. Links underline on hover.
- The button swaps the footer's colours: text colour as background, background colour as text, so white on the black footer. It sets the `--color-primary-button-*` tokens that `base.css` reads, so it stays visible if the footer colours change. The section prints the matching selection highlight (`util-selection-background`).
- Below 750px everything stacks, left-aligned: logo, links, `IT | EN`, button.

The *Utilities* section (copyright, policies, social links) is still in the footer group, disabled.

### Carousel

`sections/bounce-carousel.liquid`: image cards with a title at the top and text at the bottom, on Swiper. It uses classic section blocks: the only block you can add is **Slide**, defined inside the section (no theme blocks). JS is in `src/js/carousel.js`, styles in `src/scss/sections/_carousel.scss`.

| Section setting | Default |
|---|---|
| *Animation*: *Fade up on scroll* + *Fade up duration* (0–1s). Fades the whole carousel (`.bounce-carousel__viewport`) in as one; never the `.swiper-wrapper` (see [Fade up / fade down](#fade-up--fade-down)) | Off, 0s |
| *Width*: page (1120px) or narrow (1024px), through `.content-block` + `.content-max` / `.content-max--narrow` | Page |
| *Horizontal gap* (5–50px) → Swiper `spaceBetween` | 30px |
| *Auto-rotate slides* + *Speed* (3–10s) | Off, 5s |
| *Padding* top / bottom (Horizon's `spacing-style`) | 45px / 45px |

Each **Slide** has an image, a title, rich text, an *Overlay color* (blank means no overlay; its opacity comes from the colour's alpha), and a *Text color* (white).

- **Cards per view:** 1.2 on phones (a peek of the next card), 2 from 750px, 3 from 990px. These are Swiper `breakpoints` on Horizon's widths.
- **Card:** 353:490 ratio (490px tall at page width), 16px corners, 30px / 24px padding (local variables at the top of `_carousel.scss`).
- **Type:** title 32/48 at weight 400, text 24/32 at weight 300, from 1200px (`media('>=desktop')`). Below that, 24/36 and 18/24.
- **Ends:** `rewind`. Next on the last card goes back to the first.
- **Arrows:** 40px white circles 24px inside the edges, hidden below 750px (swipe) and when every card already fits.
- **Autoplay:** pauses on hover, and never runs for viewers who ask for reduced motion.
- **Theme Editor:** re-rendered sections re-mount through `arrive`, and `shopify:section:unload` destroys the instance. Selecting a Slide block scrolls to it and pauses autoplay until it's deselected.

### Accordion

`sections/bounce-accordion.liquid`: an FAQ list on AccordionJS (`accordion-js`), with an optional row underneath: rich-text subtext on the left and a black primary button on the right. It uses classic section blocks: the only block you can add is **Question** (*Question* text + *Answer* rich text; the question is the block's name in the editor). JS is in `src/js/accordion.js`, styles in `src/scss/sections/_accordion.scss`.

| Section setting | Default |
|---|---|
| *Animation*: *Fade up on scroll* + *Fade up duration* (0–1s). Each Question (`.ac`) and the subtext and button row (`.bounce-accordion__footer`) fade in on their own as they reach the viewport (see [Fade up / fade down](#fade-up--fade-down)) | Off, 0s |
| *Width*: narrow (1024px), page (1120px) or full (whole screen, page gutters kept) | Page |
| *Subtext* (rich text) | Hidden when empty |
| *Label* + *Link* | The button shows only when both are set |
| *Padding* top / bottom | 45px / 45px |

- **Type:** questions (and the subtext) 24px / 400 / 24px; answers 16px / 300 / 24px; all in the page text colour.
- **Rows:** 24px / 20px padding, with a 1px dashed line under every question (the browser's standard dash). An open question turns palette *color 2* (`$color4`, #F0F0F0), and its line becomes a solid seam in the page colour, so two open answers stay separate.
- **Behaviour:** several answers can be open at once; all start closed; the chevron flips when open. Animation is 300ms, or none for viewers who ask for reduced motion.
- **AccordionJS CSS:** not imported. It's mostly demo styling (Arial, borders, a "+" icon), so the few rules its JS needs (panel `overflow`, `height`, `visibility`) live in `_accordion.scss`. Panels start collapsed in CSS, so answers don't flash open before the deferred script runs.
- **Theme Editor:** re-rendered sections re-mount through `arrive`; `shopify:section:unload` destroys the instance; selecting a Question block opens it.

### Smooth scroll (Lenis)

`src/js/smooth-scroll.js` runs [Lenis](https://github.com/darkroomengineering/lenis) for wheel and trackpad scrolling, ported from the FDRY theme. Lenis keeps native scrolling and only eases the input, so `position: sticky`, Horizon's sticky header and `IntersectionObserver` keep working.

- **Feel.** Each wheel step is a 1.2s easeOutExpo tween (`SCROLL_DURATION`, `easeOutExpo`), the same config as FDRY and [lionandmason.com](https://lionandmason.com/). Raise `SCROLL_DURATION` for a longer glide. While a duration is set Lenis ignores `lerp`, and the same curve applies to anchor links.
- **Which element scrolls.** From 990px Lenis runs on `.page-wrapper`, with `#MainContent` as the content it watches for size changes. Below 990px it runs on the window (see [Things that differ from Dawn](#things-that-differ-from-dawn) #2). When the viewport crosses 990px it is destroyed and rebuilt on the other container. Lenis puts its `lenis` classes on whichever element it scrolls. The 990 width is copied from `assets/scroll-container.js`; keep them in sync.
- **Where it doesn't run.** Not in the Theme Editor (`Shopify.designMode`), so the editor's jump to a selected section isn't fought. Not with `prefers-reduced-motion`.
- **Mobile.** Touch scrolling stays native (`syncTouch` is off), so phones keep their own momentum and the address bar still hides. Below 990px Lenis only affects wheel or trackpad input (a narrow desktop window, or a tablet with a trackpad).
- **GSAP clock.** Lenis steps on `gsap.ticker` with `lagSmoothing(0)`, as Lenis recommends, so a GSAP scroll effect added later reads the smoothed position in the same frame.
- **Locking the page.** `overflow: hidden` doesn't stop Lenis, because it scrolls with `scrollTo()`. Horizon's `lockScroll()` (`assets/utilities.js`) sets `html[scroll-lock]` for every dialog and drawer (cart, search, quick add, theme drawer). A `MutationObserver` on that attribute stops and restarts Lenis. A new overlay only needs to go through `lockScroll()` / `unlockScroll()`.
- **Nested scroll.** `allowNestedScroll: true` lets inner scroll areas (drawers, menus, predictive search) scroll natively. For our own scroll containers you can also add `data-lenis-prevent`.
- **Anchors.** Same-page `#hash` links glide to the target below the header (offset by `#header-component`'s height when the header is sticky), update the URL and move focus to the target. The skip link (`.skip-to-content-link`), links clicked while Lenis is stopped and links to other pages are left to the browser.
- **CSS.** `src/scss/base/_motion.scss` pulls in `~lenis/dist/lenis.css` and sets `.lenis { scroll-behavior: auto !important }`. That cancels `base.css`'s `scroll-behavior: smooth` on `html` and `.page-wrapper`, which would otherwise smooth every Lenis frame a second time.
- **Scroll-driven effects later.** If you add ScrollTrigger (parallax, scrubbed fades), its `scroller` must be `.page-wrapper` from 990px and the window below it. Create the triggers inside `gsap.matchMedia()` so they are rebuilt at the breakpoint. `getLenis()` returns the instance, or `null` where it's off.

### Fade up / fade down

`src/js/fade.js` fades elements in as they reach 90% of the viewport height, ported from the FDRY theme. It's a paused `gsap.fromTo` on `y` and `opacity`, `power3.out` over 2s, which an `IntersectionObserver` plays once. Add the attributes in Liquid; no JS changes are needed per section.

| Attribute | Effect | Default |
|---|---|---|
| `data-fade-up` | Rises into place from below | 50px, 2s |
| `data-fade-down` | Drops into place from above | 50px, 2s |
| `data-fade-up-delay` / `data-fade-down-delay` | Seconds before it starts | `0` |
| `data-fade-up-duration` / `data-fade-down-duration` | Seconds **added to** the 2s base, so `".2"` is 2.2s | `0` |
| `data-fade-up-distance` / `data-fade-down-distance` | Travel in px | `50` |
| `data-fade-up-group` | Put on a wrapper: its direct `p`, `h1`–`h6`, `ul`, `ol`, `img`, `figure`, `blockquote` and `hr` children each fade up. A value (e.g. `"0.1"`) staggers them | no stagger |

```liquid
<div class="bounce-usp-bar__intro" data-fade-up-group="0.1">
  <h2>{{ section.settings.title }}</h2>
  {{ section.settings.text }}
</div>
<div class="bounce-usp-bar__image" data-fade-up data-fade-up-delay="0.3">…</div>
```

Consecutive items with `-duration` `.2`, `.4`, `.6`… start together and land one after another, which gives a cascade. Use `-delay` to make them start one after another instead. Elements already past 90% on load play straight away, and so do elements above the viewport (e.g. after a reload lower down).

- **Mobile.** Fades run on every device. They don't depend on Lenis: the observer fires whatever does the scrolling. To turn them off on touch devices, add a `(hover: none) and (pointer: coarse)` check to both `snippets/bounce-motion-gate.liquid` and `initFades()`, so the hide class is never set.
- **Hiding before JS.** `_motion.scss` sets `opacity: 0` on these elements and on group children, but only under `html.bounce-fade`. `snippets/bounce-motion-gate.liquid` adds that class from an inline script in `<head>` (both layouts), so nothing flashes. `fade.js` adds `bounce-fade-ready` once it is set up. If that hasn't happened by the window `load` event (bundle failed or blocked), the class comes off and the content shows without the fade. With `prefers-reduced-motion` the class is never set.
- **Theme Editor.** Fades are mounted with `arrive`, so a section the editor re-renders fades in again rather than staying hidden. `shopify:section:unload` kills its tweens.
- **Why not ScrollTrigger.** ScrollTrigger works from positions it stores, which can go stale, and an element left at its start state is invisible. `IntersectionObserver` checks each element's real box on every scroll and reflow, in either scroll container.
- **Header.** Each `.header__row` in `sections/header.liquid` has `data-fade-down`, as FDRY puts it on `.site-header__inner`. The row is in view on load, so the observer's first callback plays it straight away. Nothing waits for scrolling or the `load` event. After a reload lower down, the row counts as above the viewport and plays too. The header background is a separate underlay, so the bar shows at once and its content drops in.
  - Don't move the attribute to `#header-component`: the sticky header fades it with `opacity` (`.header[data-sticky-state='idle']`), which the tween's inline `opacity: 1` would override.
  - Don't move it to `.header-section` either: it is the sticky element.

**From the Theme Editor.** An **Animation** group sits at the top of the settings of:

- Horizon's **Text** block (which includes the Heading preset) and **Button** block;
- our **Bounce carousel** section, which fades the whole carousel;
- our **Bounce accordion** section, which fades each question and then the subtext and button row, each on its own.

All four use the same two settings:

| Setting | Attribute it prints | Default |
|---|---|---|
| *Fade up on scroll* (`fade_up`) | `data-fade-up` | Off |
| *Fade up duration* (`fade_up_duration`), 0–1s in 0.1s steps, shown only when the fade is on | `data-fade-up-duration`, added to the 2s base, so 0.3 is 2.3s. Not printed at 0 | 0s |

- **The snippet.** `snippets/bounce-fade-attributes.liquid` turns those settings into attributes. `snippets/text.liquid` and `snippets/button.liquid` render it on the text element and the button's `<a>`. The two sections pass it `section.settings` instead of `block.settings`. Other blocks share those two snippets but have no Animation settings, so they print nothing.
- **Adding it to another block or section.** Copy the Animation header and its two settings, and render the snippet on the element to fade, passing `block.settings` or `section.settings` (and `section.settings` in `visible_if`). Render it between two attributes with quoted values (see the whitespace note below).
- **The headers.** Our group sits first, so the original fields get a header of their own: *Text* / *Button* in the blocks, *Carousel* / *Accordion* in the sections. Otherwise they would appear under *Animation*. All the headers reuse Horizon's translation keys, so they show in Italian in an Italian admin. The setting labels themselves are plain English.
- **A button without a link** never fades. Horizon renders it with `aria-disabled` and dims it with `opacity: 0.5`, which the fade's inline `opacity: 1` would override.
- **Where not to turn it on.** In the two blocks, the checkbox's help text warns against product info, the cart and collection filters, for the reason in the table below.

**Where to put the attributes.** The attributes work in any section the server renders once. That covers our `bounce-*` sections and Horizon's static sections alike. The only places they break are the areas Horizon patches after the page has loaded.

| Where | Use fades? | Why |
|---|---|---|
| Our `bounce-*` sections, blocks and snippets | Yes | Our files, so no core edit |
| Horizon's static sections: Hero, Custom section, Rich text, Media with content, Marquee… | Yes, as a core edit | They render once, and the Theme Editor re-renders them as new elements, which `fade.js` fades again. But the files are Horizon's: log every edit in the [Core edits log](#core-edits-log) and re-apply it when Horizon updates |
| Areas Horizon patches after load: the cart, collection grid and filters, product info on variant change, search results, quick add, recommendations, product cards | No | Horizon copies fresh server HTML onto the existing elements (see [Things that differ from Dawn](#things-that-differ-from-dawn) #1). That removes the inline `opacity: 1` the tween left, `arrive` doesn't fire for a patched element, and the element goes back to hidden for good. Fade something outside the patched area instead, e.g. the heading above a collection grid |

In a Horizon section, put `data-fade-up` on the wrapper around the blocks. Hero's is `.hero__content-wrapper` in `sections/hero.liquid`, and its text, buttons and other blocks then fade in as one:

```liquid
<div
  class="hero__content-wrapper …"
  data-fade-up
  style="…"
>
  {% content_for 'blocks' %}
</div>
```

`data-fade-up-group` doesn't work there. It only fades direct `p`, `h1`–`h6`, `ul`, `ol`, `img`, `figure`, `blockquote` and `hr` children, and Horizon's blocks render as `<div>` or `<rte-formatter>`. `snippets/section.liquid` is the wrapper shared by most Horizon sections, so an attribute there fades every one of them. Watch the whitespace too. `{%- if … -%}` strips the space before it, so a bare attribute written right before one gets glued to the next attribute (`data-fade-upstyle="…"`). Put it before an attribute that has a quoted value, as `sections/header.liquid` does.

**What not to fade, anywhere.**

- **The hero image, or whatever is the largest thing above the fold.** It counts for Largest Contentful Paint, and holding it at `opacity: 0` until the tween delays that score. Fade the hero's text, not its media. FDRY keeps its hero image unfaded for the same reason.
- **Elements Horizon already animates.** Don't fade the Jumbo text block when its Blur or Reveal effect is on, or individual slideshow slides, which have their own scroll-driven animation (`blocks/_slide.liquid`). Fade the section around them.
- **A `.swiper-wrapper`.** GSAP animates the inline `transform` and clears it when the tween ends, but Swiper moves the wrapper with an inline `transform` too. Fade the `.swiper` container or the section heading instead. Any other element with its own CSS transform only conflicts while the tween runs.
- **An element whose own `opacity` a state class changes**, such as `#header-component`. The tween leaves an inline `opacity: 1`, which beats the class.

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

### JS: our Parcel bundle

Everything goes through `src/bounce.js` → `assets/bounce.js`: site code, `arrive`, `swiper`, `accordion-js`, `gsap`, `lenis`. Put entry-level imports in `src/bounce.js` and features in `src/js/`.

**Mount widgets with `arrive`, and clean up in the Theme Editor:**

```js
// src/js/sliders.js
import 'arrive';
import Swiper from 'swiper';
import { Navigation } from 'swiper/modules'; // import only the modules you use

function mount(el) {
	if (el.swiper) return; // Swiper stores its instance on the element
	new Swiper(el, {
		modules: [Navigation],
		navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
	});
}

export function initSliders() {
	// existing: true also runs for sliders already on the page
	document.arrive('.bounce-slider', { existing: true }, mount);

	document.addEventListener('shopify:section:unload', (event) => {
		event.target.querySelectorAll('.bounce-slider').forEach((el) => el.swiper?.destroy());
	});
}
```

Swiper's CSS comes in through SCSS by file path: `@use '~swiper/swiper.css';`, plus any module CSS you need, e.g. `~swiper/modules/navigation.css`. Parcel's Sass importer ignores Swiper's `exports` map, so `'swiper/css'` isn't found, and `'~swiper/swiper'` without the extension resolves to the JS file. `src/js/carousel.js` + `_carousel.scss` is the working example of this whole pattern.

**Call Horizon components**: wait until they're defined:

```js
async function openCartDrawer() {
	await customElements.whenDefined('theme-drawer');
	document.querySelector('theme-drawer#cart-drawer')?.open();
}
```

**Scroll listeners**: cover both scroll containers:

```js
const pageWrapper = document.querySelector('.page-wrapper');
const scrollTop = () => window.scrollY || pageWrapper?.scrollTop || 0;

function onScroll() {
	document.body.classList.toggle('is-scrolled', scrollTop() > 50);
}

window.addEventListener('scroll', onScroll, { passive: true });
pageWrapper?.addEventListener('scroll', onScroll, { passive: true });
```

Other hooks: `window.Theme` (routes, translations), theme events by their string names (see `assets/events.js`), and Shopify's standard cart actions (`window.Shopify.actions`).

**Keep entries directly in `src/`.** If you ever split a heavy library into its own file (a second entry loaded only by one section), put that entry file in `src/`, not a subfolder. Parcel copies entry subfolders into the output (`src/js/x.js` → `assets/js/x.js`), and Shopify's `assets/` can't hold subfolders. Files imported by an entry can live anywhere.

### Optional: extending Horizon's own components

Only needed if you want to subclass Horizon's `Component` class (for `ref=""` and `on:click="/method"`) or import its helpers. Parcel can't resolve `@theme/*`, so write these as plain ES modules directly in `assets/` (not in `src/`), prefixed `bounce-`:

```js
// assets/bounce-countdown.js
import { Component } from '@theme/component';

class BounceCountdownComponent extends Component {
	requiredRefs = ['label'];

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

End the tag name in `-component` so `on:*` attributes find it.

---

## 8. Build pipeline

```
src/bounce.scss ──┐                              ┌─ assets/bounce.css ─┐
                  ├─ Parcel (sass, lightningcss, ┤                     ├─ layout/theme.liquid (after content_for_header)
src/bounce.js ────┘   SWC, minify)              └─ assets/bounce.js ──┘  layout/password.liquid
```

| Command | What it does |
|---|---|
| `pnpm dev` | `parcel watch` → rewrites `assets/bounce.*` and their `.map` files on save |
| `shopify theme dev --store <store>` (second terminal) | Syncs `assets/` to a dev theme with hot reload, so it picks up Parcel's output |
| `pnpm build` | Production build (minified, no source maps). **Run before every commit.** The GitHub integration has no build step, so the committed `assets/bounce.*` is exactly what goes live |
| `pnpm clean` | Removes `.parcel-cache` |

### Deploying through the GitHub integration

- **What syncs:** only the standard theme folders (`assets`, `blocks`, `config`, `layout`, `locales`, `sections`, `snippets`, `templates`). Shopify's docs: "Folders in the repository that don't match the default theme structure are ignored." So `src/`, `package.json`, `pnpm-lock.yaml`, `README.md`, this file and the dotfiles can be committed safely; they never reach the store.
- **`.gitignore` vs `.shopifyignore`:** `.gitignore` decides what goes into git, which is what the integration syncs. `.shopifyignore` only applies to the Shopify CLI.
- **Shopify commits back:** Theme Editor and admin changes (`config/settings_data.json`, `templates/*.json`, section groups) are committed to the connected branch automatically, and this can't be turned off. Pull before you start working to avoid merge conflicts on those files.

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
| 4 | `_base.scss` hard-coded `h1–h4` sizes (70/50/40/30px) and forced the **body** font plus weight 700 on all headings | Overrode the Typography settings: editor changes to heading font/size did nothing | **Fixed.** Rules emptied in `_base.scss`. Set sizes and fonts in the editor, or lock them via tokens (`:root { --font-h1--size: … }`) |
| 5 | `_btn.scss` targets `.btn` and sets `--top-bottom-padding` / `--left-right-padding` (Dawn names) | No effect: Horizon markup has no `.btn`, and its buttons read `--button-padding-block/inline` | **Fixed.** `_btn.scss` now targets `.button, .button-secondary` with the design spec (see [Button component](#button-component)) |
| 6 | include-media breakpoints 480/768/1024/1440 vs Horizon's 750/990/1200/1400 | Our layout switched at different widths than Horizon's (e.g. 750–767px) | **Fixed.** `_media.scss` uses 750/990/1200/1400 (§4) |
| 7 | No `browserslist` | Parcel had no explicit browser targets for transpiling JS and lowering CSS | **Fixed.** `"browserslist": "defaults and supports es6-module, ios_saf >= 16.4, safari >= 16.4"` (88% global coverage). 16.4 is the floor because Horizon needs import maps. The build still outputs range media queries (`@media (width<=749px)`), which every target supports |
| 8 | `.babelrc` with only `@babel/preset-env` | Parcel warned on every build: it forced Babel (slower) and ignored Parcel's targets | **Fixed.** `.babelrc` and `@babel/*` removed. Parcel's built-in SWC transpiles using `browserslist` |
| 9 | `minify-js` runs `terser` after `parcel build` | Parcel already minifies, so this was a redundant second pass | **Fixed.** Script and `terser` removed |
| 10 | No `--public-url ./` | Parcel defaults to `/`, so any `url()` asset or code-split chunk would point at the store root, not the CDN `assets/` path. Parcel also never cleans `assets/`, so hashed files would pile up | **Fixed.** `--public-url ./` on `dev` and `build`. Still prefer referencing images and fonts from Liquid (`asset_url`) over `url()` in SCSS, so no hashed copies land in `assets/` |
| 11 | `parcel watch` writes `.map` files into `assets/` | Wanted for debugging, but they'd be committed and synced to the store | **Fixed.** Kept for dev; `assets/*.map` is in `.gitignore`, and `pnpm build` deletes them first |
| 12 | Dependencies from the old project: `arrive`, `accordion-js`, `swiper`, `buffer`, `process` | Fine with Horizon. `buffer`/`process` are only bundled if code uses `Buffer`/`process`. Swiper is the heavy one and loads on every page | Kept by choice. Import only the Swiper modules you use, and read [Things that differ from Dawn](#things-that-differ-from-dawn) before mounting widgets inside Horizon's sections |
| 13 | `parcel` sat in `dependencies`; name/repo were from the old project | Cosmetic | **Fixed.** Renamed to `bounce`, `"private": true`, `parcel` moved to `devDependencies`, old `repository` removed (add the new one once the GitHub repo exists) |
| 14 | `.gitignore` ignores `pnpm-lock.yaml`, `.babelrc`, `.parcelrc`, `README.md` | Teammates get unpinned installs and a different build | **Fixed.** `README.md`, `.parcelrc`, `.babelrc` removed from `.gitignore` (none of them would sync to the store anyway). `pnpm-lock.yaml` is no longer ignored; commit it |
| 15 | Project isn't a git repo yet | Nothing to diff when Horizon ships an update | Partly fixed. Repo created, but the first commit already contains our edits (layout includes, this file). For a clean baseline, keep the untouched Horizon 4.2.0 download on its own branch |
| 16 | `src/bounce.js` imports `test.js` (logs "Hello World") | Console noise on the storefront | **Fixed.** `test.js` removed |

Checked and fine: the `~include-media/…` path resolves in Parcel, and forwarding include-media `with ($breakpoints: …)` while `_media.scss` also declares `$breakpoints` compiles without conflict.

All `package.json` changes from this review are applied (see `package.json`).

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
| `layout/theme.liquid`, `layout/password.liquid` | Added `{%- render 'bounce-fonts' -%}` after `{%- render 'fonts' -%}` | Load Simplon Mono early in `<head>` (see [Custom font](#custom-font-simplon-mono)) |
| `layout/theme.liquid`, `layout/password.liquid` | Added `{%- render 'bounce-motion-gate' -%}` after `bounce-fonts` | Hide fade elements before first paint, only when `fade.js` will play them (see [Fade up / fade down](#fade-up--fade-down)) |
| `snippets/color-palette.liquid` | Prints `--selection-background` on `:root`, buttons (including hover), inputs and selected variant labels | Black highlight on white text, pink (`color_palette.color1`) otherwise (see [Text selection](#text-selection)) |
| `snippets/contrast-override.liquid` | Prints `--selection-background` next to `--color-foreground` on `.color-custom-{id}` | Same rule inside a section or block with its own text color |
| `snippets/slideshow-controls.liquid` | `--selection-background: #000` beside the existing `--color-foreground: #fff` on controls drawn on media | Those controls are hardcoded white and don't go through the tokens above |
| `sections/header.liquid` | `localization_markup` renders `bounce-language-switcher` instead of the country/language dropdown. The `actions` capture passes `show_account` / `show_cart` and renders `bounce-buy-button` after `header-actions`. Schema: added `show_account`, `button_label`, `button_link`, `show_cart` (the cart bubble settings only show with the cart on); removed `show_country` and `country_selector_style`. `data-fade-down` on each `.header__row` | IT \| EN switcher, Acquista button and icon toggles (see [Header](#header)). The rows drop in on load (see [Fade up / fade down](#fade-up--fade-down)) |
| `snippets/header-actions.liquid` | Optional `show_account` / `show_cart` params; `false` skips the account block or the cart trigger. `<header-actions>` and its live region always render | Toggles for the account and cart icons |
| `snippets/header-drawer.liquid` | The utility-links localization block (flag, currency, submenu) is replaced by `bounce-language-switcher` | Same switcher in the mobile drawer; the removed country settings are no longer read |
| `locales/it.json`, `locales/en.default.json` | Added `bounce.buy_button` (`Acquista` / `Buy now`) | Default button label per language |
| `blocks/text.liquid`, `blocks/button.liquid` | Schema: an *Animation* group (`fade_up`, `fade_up_duration`) at the top of the settings, then a *Text* / *Button* header over the original fields | Fade-up option in the editor (see [Fade up / fade down](#fade-up--fade-down)) |
| `snippets/text.liquid`, `snippets/button.liquid` | Render `bounce-fade-attributes` on the text element and on the button's `<a>` (the button only when it has a link) | Same |
| `sections/section.liquid` | *Padding* top / bottom: max 100 → **200px**, step 1 → **2** | The design needs taller spacing in Custom section (and its Rich text preset, the same file). Shopify caps a range at 101 steps, so 0–200 needs a 2px step; every saved value was already even |
