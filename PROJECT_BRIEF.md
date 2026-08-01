# BeautyRoute — Handoff Brief for the Dev

One page, no fluff. Full vision doc exists but you don't need to read it — this is
everything actionable.

## The idea, in one line

An operating system for mobile beauty professionals (starting with hairstylists in
Saudi Arabia) that replaces WhatsApp + Instagram + Google Calendar + a paper notebook +
Maps + a banking app + a camera roll + memory — with one app whose real product is a
**Beauty Passport**: a permanent, structured memory of every client (hair formula,
allergies, photos, notes, history) that makes every future visit better.

**The differentiator is not booking.** Everyone has booking (Fresha, Booksy). The pitch
is: *"we turn every visit into knowledge that improves every future visit."*

## What's already built

A working React + Vite scaffold, live in this repo. Run `npm install && npm run dev`.
It's UI + mock data only — no backend yet. Treat it as the target look/feel and
information architecture, not final code — refactor freely.

## The six engines (= your six feature domains)

| # | Engine | Core job | MVP priority |
|---|---|---|---|
| 1 | **Beauty Memory Engine** | Client profile ("Beauty Passport"): hair history, formulas, allergies, photos, notes, AI insights | **P0 — build first** |
| 2 | **Appointment Engine** | Booking, calendar, waiting list, reminders, cancellations | **P0** |
| 3 | **Route Engine** | GPS, smart routing, traffic, fuel/time estimate for mobile stylists | P1 |
| 4 | **Business Engine** | Revenue, expenses, reports, analytics, loyal customers | P1 |
| 5 | **AI Engine** | Face analysis, hair recommendations, AI consultation, AI business coach | P2 |
| 6 | **Salon Engine** | Multi-staff mode: POS, inventory, commission, loyalty — unlocks once a stylist opens a physical salon | P3 (post-MVP) |

Build order matters: 1 and 2 are the whole app for a solo mobile stylist. 3–5 are
retention/differentiation. 6 is a second product mode, don't build it until 1–4 are solid.

## Suggested MVP scope (first build)

1. Auth: single stylist login (email or phone OTP — WhatsApp OTP if easy, that's the
   audience's native channel)
2. Client CRUD: the Beauty Passport — name, phone, photo, hair formula, allergies,
   free-text notes, tags
3. Visit timeline per client: date, service, notes, (optional) photo, rating
4. Appointment calendar: day/week view, create/edit/cancel, status (confirmed/pending)
5. Basic dashboard: today's schedule + client count + this month's revenue (manual entry
   is fine for v1, no need for real accounting integration yet)

Everything else (routing, AI, salon mode) is v2+.

## Suggested stack

- Frontend: React + Vite (already scaffolded) + Tailwind
- Backend: Supabase (Postgres + auth + storage for client photos) — fastest path to a
  real MVP without building your own auth/API layer from scratch
- Rough schema starting point:
  - `clients` (id, stylist_id, name, phone, since, hair_formula, allergies[], tags[], photo_url)
  - `visits` (id, client_id, date, service, notes, rating, photo_url)
  - `appointments` (id, client_id, date, time, location, status)
  - `stylists` (id, name, city, phone)

## Non-negotiables from the vision doc

- **Privacy**: client data belongs to the client and the stylist, not the platform —
  design data export/delete from day one, don't bolt it on later
- **Simplicity**: if a stylist needs training to use it, that's a failure — every screen
  should be usable with zero onboarding
- **Trust**: pricing, appointments, and payments must always be unambiguous in the UI

## What to ignore for now

Face analysis, AI business coach, salon POS/inventory, subscription billing — all real,
all in the full vision doc, all v2+. Don't let scope creep from the brief push into the
first build.
