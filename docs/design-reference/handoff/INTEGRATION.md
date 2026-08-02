# Integration guide — BeautyRoute design → existing React/Vite app

This guide is written for the development assistant working inside the real
BeautyRoute application. Your job is to migrate the design in this package
into the app's existing `src/` structure **without replacing infrastructure**.

---

## Hard guardrails — do NOT touch

Compare, adapt, and integrate the **presentation layer only**. Leave the
following exactly as they are in the target app:

- **Supabase services** — clients, queries, RPC, storage, realtime.
- **Authentication** — session handling, guards, providers, role logic.
- **Routing** — route definitions, layouts, navigation config.
- **Data-fetching logic** — hooks, loaders, caches, state stores.

The `.jsx` sources here contain **hardcoded sample data** for preview purposes.
When porting a component, keep its markup/styling/props and wire it to the app's
**existing** data sources — never import this package's sample data into
production, and never swap a working service call for one of these mocks.

---

## Dependency requirements

The design layer itself is intentionally light. Confirm/add:

| Dependency | Why | Notes |
|------------|-----|-------|
| `react`, `react-dom` | Components are React function components | Use the app's existing version (≥18). |
| Google Fonts: **Fraunces** + **Inter** | Display/heading + UI type | Loaded via `<link>` or CSS `@import` — see **Fonts** below. No font files are embedded. |
| `lucide-react` *(recommended)* | Iconography (thin 1.5px stroke) | Preview screens load Lucide from a CDN; in the app install `lucide-react` and import icons as components. Swap for the app's existing icon set if one exists. |
| `leaflet` *(only if using maps)* | `professional-dashboard/route.html` uses a real Leaflet map | Only needed if you port the Maps & Route surface. |

No CSS framework, no build plugin, and no design-system npm package is required.
Tokens are plain CSS custom properties; components use inline styles + token vars.

---

## Fonts — import instructions (no files embedded)

`tokens/fonts.css` is the source of truth for font-family tokens. It imports the
two families from Google Fonts and defines `--font-display` (Fraunces) and
`--font-body` (Inter). Do **not** copy font binaries.

Pick one loading method:

**A. Keep the CSS `@import`** (already in `tokens/fonts.css`, pulled in by
`styles.css`). Zero extra work — just import `styles.css` (see below).

**B. Preferred for Vite performance — move to `<link>` in `index.html`:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

If you use method B, delete the `@import "tokens/fonts.css";` line from your copy
of `styles.css` (keep the `--font-*` token definitions — move them into
`typography.css` or a small local file). Arabic (RTL) uses an Arabic-friendly
stack defined in `tokens/rtl.css`; confirm your chosen Arabic face is available
or add it to the Google Fonts request.

---

## Tokens — import once

Import the single root stylesheet at the app entry (e.g. `src/main.tsx` or the
root layout):

```ts
import "./styles/beautyroute/styles.css";
```

`styles.css` @imports, in order: `fonts.css`, `colors.css`, `typography.css`,
`spacing.css`, `effects.css`, `rtl.css`. Colors ship a light default plus a
`[data-theme="dark"]` block; RTL is scoped under `[dir="rtl"]`. Set `data-theme`
and `dir` on `<html>` from your existing app state — the localization helper's
`applyDir(lang)` already sets `dir`/`lang`.

---

## Suggested folder mapping into `src/`

This package is grouped by concern. A conventional Vite/React app maps it like:

```
src/
├─ styles/beautyroute/        ← copy tokens/ + styles.css here (rename import path)
│  ├─ styles.css
│  └─ tokens/*.css
├─ components/ui/             ← port components/forms, feedback, overlay, data
│  ├─ Button.tsx  Input.tsx  Select.tsx  … (from components/forms/*.jsx)
│  ├─ Badge.tsx   Toast.tsx  Tooltip.tsx … (from components/feedback/*.jsx)
│  └─ Dialog.tsx                            (from components/overlay/*.jsx)
├─ components/beauty/         ← port components/beauty/*.jsx (domain cards)
├─ components/product/        ← port components/product/*.jsx
├─ components/maps/           ← port components/maps/*.jsx (needs leaflet)
├─ components/navigation/     ← Navbar, Sidebar, Tabs, Search, LanguageSwitcher, ExperienceSwitcher
├─ components/media/          ← EditorialImage
├─ lib/i18n.ts                ← port assets/i18n.js (ESM). See localization notes.
└─ (screens/pages)            ← use ui_kits/* as visual reference for YOUR routed pages
```

`.d.ts` files sit beside each component here — fold their prop types into your
`.tsx` component signatures (or keep as `.d.ts` if you port as `.jsx`).

### How to integrate each component

1. Find the app's existing equivalent (if any) under `src/`.
2. If it exists: reconcile — adopt this package's markup structure, token
   classes/vars, and prop shape; keep the app's data wiring and event handlers.
3. If it doesn't: create it from the `.jsx` source + its `.d.ts` prop contract,
   then wire to real data.
4. Never delete or bypass an existing service/hook to make a component render.

---

## `ui_kits/` are reference, not routes

The screens in `ui_kits/` are full-page compositions showing how components come
together (Discover, Bookings, Beauty Passport, dashboard, etc.). Use them as the
**visual spec** for the app's real routed pages. Do not import them as-is — they
carry preview scaffolding and sample data. Match their layout, spacing, and
component usage inside your existing routing.

---

## Localization

- ESM helper: `assets/i18n.js` → port to `src/lib/i18n.ts`. It holds the string
  table, `Intl` formatters (`formatDate`/`formatTime`/`formatSAR`, `ar-SA` /
  `en-GB`), the **per-user language model** (`loadUserLang`/`saveUserLang`/
  `applyDir`), and `pickLocalized()` for dual-language user content.
- Model: **one active language per user**, chosen independently by clients and
  professionals, persisted to the profile (the helper uses `localStorage` as a
  stand-in — replace with your Supabase profile row). **Localize the chrome, not
  user-generated content**: names, reviews, and portfolios stay in their
  original language and are never machine-translated.
- `assets/i18n.global.js` is a plain-script mirror (`window.BRI18N`) needed only
  by the preview's non-module screens. In the app you only need the ESM version.
- See `handoff/LOCALIZATION-STATUS.md` for exactly which surfaces are done.

---

## Verification checklist after integration

- App boots with `styles.css` imported; Fraunces + Inter load; no console errors.
- Light and `[data-theme="dark"]` both render correctly.
- Switching language flips `dir`/`lang` and reformats dates/numerals/currency.
- Supabase, auth, routing, and data hooks are **unchanged** and still function.
- Ported components render from **real** app data, not this package's samples.
