# BeautyRoute — AI-Assisted Development Handoff Package

This is the complete BeautyRoute design system, packaged for migration into the
existing **BeautyRoute React/Vite application**. The entire project folder *is*
the handoff — every design token, component source, TypeScript declaration, and
the localized client-app implementation is present at its real path with its
real filename. Nothing is zipped, minified, or redesigned; the current
BeautyRoute design is preserved exactly.

## What's in here

| Path | What it is |
|------|------------|
| `styles.css` | Root stylesheet. Imports every token file below. Link/import this one file. |
| `tokens/` | Design tokens: `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`, `rtl.css`. |
| `components/` | All reusable component source (`.jsx`) + TypeScript declarations (`.d.ts`), grouped by concern. |
| `ui_kits/client-app/` | The **localized** client-app implementation (EN/AR). Reference implementation, not a drop-in. |
| `ui_kits/` (others) | `marketing/`, `auth/`, `professional-dashboard/`, `beauty-passport/` — reference screens. |
| `assets/i18n.js` | ESM localization helper (strings + `Intl` formatters + per-user language model). |
| `assets/i18n.global.js` | Plain-script mirror exposing `window.BRI18N` for non-module screens. |
| `assets/media.js` | Swappable marketing image config (`MEDIA`, `TONES`). |
| `guidelines/` | Foundation specimen cards (color, type, spacing, brand). Reference only. |
| `readme.md` | Full design-system brief, voice, and visual foundations. |
| `handoff/INTEGRATION.md` | **Start here** — setup, dependencies, folder mapping, fonts, guardrails. |
| `handoff/LOCALIZATION-STATUS.md` | Completed vs. incomplete localization surfaces. |

## For the development assistant

Read `handoff/INTEGRATION.md` first. It tells you how to compare this package
with the existing `src/` structure and integrate the design **without touching**
Supabase services, authentication, routing, or data-fetching logic.

The `.jsx` files here are authored as standalone/browser-transpiled sources for
the design-system preview environment. Treat them as the **visual + structural
source of truth** — port their markup, class usage, token references, and props
into your app's real component files. Do not wire them to data or services;
that stays in your existing code.
