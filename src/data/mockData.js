// src/data/mockData.js
//
// TODO(mockData-audit, 2026-08-05): trimmed down from its original shape.
// This file used to export `stylist`, `stylists`, `appointments`,
// `revenueByMonth`, and `engines` in addition to `clients` below -- a
// repo-wide audit (grep across src/ and supabase/) confirmed none of those
// were imported anywhere, including `revenueByMonth`, which became dead
// the moment BusinessEngine.jsx moved to real Supabase queries
// (services/revenue.ts's getRevenueSeries + services/expenses.ts's
// getExpensesSeries) in this same pass. Removed as genuinely-unused dead
// code, not a functional change.
//
// `clients` below is the one export still in use, and only by
// ClientPortal.jsx, which is intentionally still mocked -- see the TODO
// block at the top of that file for exactly why (no client-facing auth or
// business-resolution system exists yet to fetch a real client against).
export const clients = [
  {
    id: "c1",
    name: "Nour Al-Faisal",
    phone: "+966 5X XXX 1122",
    since: "2023-02-11",
    favoriteStylist: "Salma",
    allergies: ["Ammonia"],
    hairFormula: "7.3 + 20vol, 30min",
    lastVisit: "2026-06-28",
    photo: "https://i.pravatar.cc/150?img=47",
    tags: ["VIP", "Balayage"],
    timeline: [
      { date: "2026-06-28", service: "Balayage touch-up", notes: "Wants it warmer next time, less ash.", rating: 5, photo: "https://picsum.photos/seed/nour1/400/480" },
      { date: "2026-04-02", service: "Root color 7.3", notes: "Scalp sensitive near hairline — go gentle.", rating: 5, photo: "https://picsum.photos/seed/nour2/400/480" },
      { date: "2026-01-14", service: "Cut + gloss", notes: "Loved the length, keep collarbone length.", rating: 4, photo: "https://picsum.photos/seed/nour3/400/480" },
    ],
  },
  {
    id: "c2",
    name: "Rana Bakhsh",
    phone: "+966 5X XXX 8834",
    since: "2024-08-01",
    favoriteStylist: "Salma",
    allergies: [],
    hairFormula: "6.0 base, no red tones",
    lastVisit: "2026-07-10",
    photo: "https://i.pravatar.cc/150?img=32",
    tags: ["Bridal"],
    timeline: [
      { date: "2026-07-10", service: "Bridal trial", notes: "Loose curls + half-up, confirmed for Aug 20 wedding.", rating: 5, photo: "https://picsum.photos/seed/rana1/400/480" },
      { date: "2026-05-05", service: "Keratin treatment", notes: "Redo in ~4 months.", rating: 5, photo: "https://picsum.photos/seed/rana2/400/480" },
    ],
  },
  {
    id: "c3",
    name: "Dana Al-Qahtani",
    phone: "+966 5X XXX 4471",
    since: "2025-01-20",
    favoriteStylist: "Salma",
    allergies: ["PPD"],
    hairFormula: "Henna-based color only",
    lastVisit: "2026-05-19",
    photo: "https://i.pravatar.cc/150?img=25",
    tags: ["New"],
    timeline: [
      { date: "2026-05-19", service: "Henna color + trim", notes: "Confirmed no reaction. Continue henna line.", rating: 5, photo: "https://picsum.photos/seed/dana1/400/480" },
    ],
  },
];
