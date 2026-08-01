# Localization status — completed & incomplete surfaces

Model: **one active language per user** (EN `en-GB` / AR `ar-SA`), chosen
independently by clients and professionals, persisted to the profile. Localize
the **chrome** (nav, buttons, forms, tags, empty states, dates, numerals,
currency); never machine-translate user-generated content (names, reviews,
portfolios). Numerals/dates/currency format through shared `Intl` helpers.

## ✅ Completed

**Phase 1 — Runtime i18n foundation**
- `assets/i18n.global.js` (new) exposes `window.BRI18N`: `t()`, plural `p()`,
  `dir()`/`applyDir()`, `Intl` formatters (`formatDate`, `formatTime`,
  `formatSAR`), `pickLocalized()`.
- `assets/i18n.js` (ESM) kept in sync.

**Phase 2 — Client-app flow** (`ui_kits/client-app/`)
- `ClientViews.jsx`, `index.html`, `BookingScreen.jsx`, `booking.html` — every
  UI string swaps on `br.user.lang`; Arabic-Indic numerals; native date/time/
  currency; per-language casing (uppercase tracking EN, none AR). Language
  persists and restores; RTL/LTR flips automatically.

**Phase 3 — DS component internals (partial)**
- `components/beauty/BookingLocations.jsx` (+ `.d.ts`) — dynamic provider-driven
  labels; takes a `lang` prop.
- `components/navigation/ExperienceSwitcher.jsx` (+ `.d.ts`) — localized option
  labels; takes a `lang` prop.

## ⛔ Incomplete — remaining surfaces (Phase 4)

Extend the same `BRI18N.t()` / `lang`-prop pattern to:

- **Professional dashboard** (`ui_kits/professional-dashboard/`) — booking
  management, calendar/availability, earnings/analytics, settings.
- **Auth kit** (`ui_kits/auth/`) — sign-in, onboarding, language selection.
- **Marketing kit** (`ui_kits/marketing/`) — landing and promotional surfaces.
- **Beauty Passport** (`ui_kits/beauty-passport/`) — not yet localized.
- **DS component internals still carrying English fallbacks:**
  - `components/beauty/RebookCard.jsx` (+ `.d.ts`)
  - `components/maps/TravelCard.jsx` (+ `.d.ts`)
  - `components/beauty/BookingCard.jsx` (+ `.d.ts`)

## Notes for the app

- Replace the helper's `localStorage` language stand-in with the real Supabase
  **profile row**; keep the same `applyDir()` behavior on load and on change.
- User content fields that are dual-language should be shaped `{ en, ar }` and
  read via `pickLocalized(field, lang)` — which falls back to the other language
  rather than rendering empty.
- AI responses and outbound templates (email/SMS/WhatsApp) should default to the
  user's language unless they request otherwise.
