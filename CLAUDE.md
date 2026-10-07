# Bounce — agent guide

Bounce is built on **Horizon 4.2.0** (`theme_info` in `config/settings_schema.json`). It is **not Dawn**; several Dawn habits actively break here.

`theme-structure.md` in the repo root is the full architecture and override guide. This file carries the rules that are expensive to get wrong — **read the referenced `theme-structure.md` section before non-trivial work in that area**. `AGENT.md` is the complete Liquid filter / tag / object reference.

## Hard rules

1. **Prefix everything we create with `bounce-`** — `sections/bounce-footer.liquid`, `snippets/bounce-colors.liquid`, `assets/bounce-countdown.js`. A diff against a new Horizon release then shows at a glance which files are ours. → §1
2. **Override ladder, try the top one first:** Theme Editor setting → override a CSS variable → CSS rule in `bounce.css` → new `bounce-*` section/block/snippet → **edit a Horizon core file (last resort — keep it small and log it in the Core edits log, §10)**. → §7
3. **Horizon already prints every theme setting as a CSS custom property** on `:root` (`snippets/theme-styles-variables.liquid`, `snippets/color-palette.liquid`). Do **not** add a Dawn-style `:root` block to `theme.liquid` — map the existing variables in `src/scss/base/_variable.scss` (`$fontHeading: var(--font-heading--family);`). A genuinely new merchant-editable value goes: setting in `config/settings_schema.json` → printed in a new `snippets/bounce-variables.liquid` → mapped in `_variable.scss`. → §3, §6
4. **Never hard-code colors.** Use `var(--color-foreground)` / `var(--color-background)` so the component recolors correctly inside any section (`snippets/contrast-override.liquid` scopes them per section). Text whose colors bypass those tokens sets `--selection-background` (its text color) and `--selection-color` (its background color), or the selection highlight won't invert. → §3
5. **Sass color functions can't read `var()`** (`darken()`, `rgba($var, .5)`, `color.adjust`). Use the `-rgb` twins — `rgb(var(--color-foreground-rgb) / 0.5)` — or `color-mix()`. → §3
6. **Run `pnpm build` before every commit.** The GitHub integration has no build step, so the committed `assets/bounce.*` is literally what goes live. → §8
7. **`templates/*.json`, `config/settings_data.json` and `sections/*-group.json` are editor content, not code.** Shopify commits Theme Editor changes back to the branch automatically and this can't be turned off — pull before you start working. → §1, §8

## Where code goes

- Our source is **`src/`** (SCSS + JS), compiled by Parcel to `assets/bounce.css` and `assets/bounce.js`. `src/` is in `.shopifyignore` and never reaches the store. Keep **entry files directly in `src/`** — Parcel mirrors entry subfolders into the output and Shopify's `assets/` can't hold subfolders. Imported files can live anywhere. → §8, §7
- Both bundles load **after `{{ content_for_header }}`** in `layout/theme.liquid` and `layout/password.liquid`, so they come last in `<head>` and win ties at equal specificity against the `{% stylesheet %}` CSS Shopify injects through that tag. → §2
- **Breakpoints** via include-media (`src/scss/base/_media.scss`), matching Horizon's: `mobile` 750, `tablet` 990, `desktop` 1200, `wide` 1400.  → §4
- **Content widths** are 1024 / 1120 / 1440px. Our markup: `.content-block` for the gutters + `.content-max` / `.content-max--narrow` / `.content-max--wide`. To make a *whole* section wide, put Horizon's class on the section schema (`"class": "page-width-wide"`) — the utility class can't grow past the section's own content column. → §7
- **Buttons are `.button`, `.button-secondary`, `.button-custom` — never `.btn`.** Style them by setting the tokens `base.css` reads (`--button-padding-inline`, `--font-paragraph--size`), not `font-size`/`padding` directly: `bounce.css` loads last, so a direct rule also overrides the buttons Horizon sizes on purpose (checkout, sticky add to cart, icon buttons). → §7
- All four font roles are **Simplon Mono**, locked in `src/scss/base/_fonts.scss`. → §7

## JS traps — these differ from Dawn (→ §5)

- **Horizon patches sections in place** (`assets/morph.js`) instead of replacing them: the cart, collection grid and filters, search, product info on variant change, quick add, product cards, recommendations. Classes and attributes your JS added inside those areas are reset to the server's version, and **`arrive` does not fire** because the elements aren't new. Mount widgets in our own `bounce-*` sections; inside Horizon's areas, re-initialise after the update or keep state in server-rendered markup.
- **On desktop the window does not scroll.** From 990px, `html`/`body` are `overflow: hidden` and `.page-wrapper` is the scroll container — `window.scrollY` stays `0` and window scroll events never fire. On mobile the window scrolls normally. Listen on both, or use `IntersectionObserver`.
- Horizon's modules load with `fetchpriority="low"`, so they may not be ready when our bundle runs. `await customElements.whenDefined('<tag-name>')` before calling a method on one of its elements.
- Mount with `arrive` (`{ existing: true }`) and **destroy instances on `shopify:section:unload`**, or the Theme Editor leaks them. Working example of the whole pattern: `src/js/carousel.js` + `src/scss/sections/_carousel.scss`.
- Parcel can't resolve Horizon's `@theme/*` imports. To subclass its `Component` class (for `ref=""` and `on:click="/method"`), write a plain ES module straight into `assets/` as `bounce-*.js`, with a tag name ending in `-component`.

## Animation (→ §7 *Fade up / fade down*, *Smooth scroll*)

- Fades are **attribute-driven**, no JS change per section: `data-fade-up` / `data-fade-down`, plus `-delay`, `-duration`, `-distance`, `-group`. Use `-delay` to sequence items; `-duration` only adds to the fixed 2s fade. `snippets/bounce-fade-attributes.liquid` prints them from section/block settings.
- **Do not fade:** the hero image or whatever is the largest element above the fold (it's the LCP), a `.swiper-wrapper` (Swiper owns that inline `transform`), elements Horizon already animates (Jumbo text effects, individual slideshow slides), anything whose own `opacity` a state class drives (`#header-component`), or anything inside an area Horizon patches — it goes back to hidden for good.
- **Lenis** drives wheel/trackpad scrolling (`src/js/smooth-scroll.js`). It's off in the Theme Editor and under `prefers-reduced-motion`; touch scrolling stays native. A new overlay must go through Horizon's `lockScroll()` / `unlockScroll()` (`assets/utilities.js`) or Lenis keeps scrolling behind it; inner scroll areas take `data-lenis-prevent`.

## Liquid & schema conventions (→ `AGENT.md` for the full reference)

- Snippets, and blocks rendered statically via `{% content_for 'block' %}`, **must** open with a `{% doc %}` header (`@param`, `@example`).
- **No Liquid inside `{% stylesheet %}` or `{% javascript %}`** — it causes syntax errors. One of each tag per file, and both only work in `sections/`, `blocks/`, `snippets/`. Use `{% style %}` when you need Liquid (it also live-updates in the editor).
- `blocks/_name.liquid` = **private** block (only usable where a section/block names it explicitly). `blocks/name.liquid` = public, accepted anywhere `"@theme"` is allowed.
- A setting driving **one** CSS property → a CSS variable in `style=""`. A setting driving **several** → one class per option.
- Reuse `{% render 'section' %}` (`snippets/section.liquid`) in our sections to get Horizon's background media, color override, border, spacing and layout controls for free.
- Validate every `{% schema %}` with the project skill `.claude/skills/shopify-section-schema`.
- Liquid has **no parentheses and no ternary** — nest `{% if %}` instead.
- Every user-facing string goes through `| t`, in **both** `locales/it.json` and `locales/en.default.json` (Italian is the primary storefront language). Our keys live under `bounce.*`. Sentence case.

## Already built — extend these rather than rebuild

`snippets/bounce-fade-attributes.liquid`, `snippets/bounce-language-switcher.liquid` (IT | EN), `snippets/bounce-buy-button.liquid` (shared header/footer *Acquista* button), `snippets/bounce-colors.liquid`, `snippets/bounce-motion-gate.liquid`, and the sections `bounce-footer`, `bounce-carousel`, `bounce-accordion`, `bounce-contact-form`. → §7

## Build (→ §8)

| Command | What it does |
|---|---|
| `pnpm dev` | `parcel watch` → rewrites `assets/bounce.*` and their `.map` files on save |
| `shopify theme dev --store <store>` | Second terminal: syncs `assets/` to a dev theme with hot reload |
| `pnpm build` | Production build, minified, no source maps. **Before every commit.** |
| `pnpm clean` | Removes `.parcel-cache` |
