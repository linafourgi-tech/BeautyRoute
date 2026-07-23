# SalmaRoute — BeautyOS

A working React + Vite scaffold for the SalmaRoute / BeautyOS platform described in the
project brief: an operating system for mobile beauty professionals, built around six
engines, with the **Beauty Memory Engine** (the client "Beauty Passport") as the core
differentiator.

## What's in this scaffold

- **React 19 + Vite** — fast dev server, instant HMR
- **React Router** — one route per engine
- **Tailwind CSS v4** — design tokens (colors, fonts) defined in `src/index.css`
- **Recharts** — revenue chart in the Business Engine
- **lucide-react** — icon set
- All data in `src/data/mockData.js` — swap this for real API calls once the backend exists

## Pages / Engines

| Route | Engine | Status |
|---|---|---|
| `/` | Dashboard | overview, today's schedule, engine grid |
| `/appointments` | Appointment Engine | day-by-day bookings |
| `/passport` | Beauty Memory Engine (star) | client list + Beauty Passport detail + hair timeline |
| `/route` | Route Engine | stop list + placeholder map |
| `/business` | Business Engine | revenue/expense chart, loyal clients |
| `/ai` | AI Engine | chat UI stub — wire to a real model + client DB |
| `/salon` | Salon Engine | locked preview for the future salon plan |

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for production

```bash
npm run build
npm run preview
```

## Next real steps (see PROJECT_BRIEF.md)

1. Replace `src/data/mockData.js` with a real backend (Supabase/Postgres recommended for
   an MVP — see brief for schema starting point).
2. Add auth (stylist login, eventually multi-staff for the Salon Engine).
3. Wire the Route Engine to Google Maps/Mapbox Directions API.
4. Wire the AI Engine to a real model call, scoped to a client's Beauty Passport data only.
5. WhatsApp Business API integration for reminders (mentioned as the number-one tool
   stylists already live in).
