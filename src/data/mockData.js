// src/data/mockData.js

// 1. Core user/professional details (supporting both singular and plural forms)
export const stylist = {
  name: "Salma Al-Ajili",
  role: "Mobile Hairstylist",
  city: "Riyadh",
  rating: 4.9,
};

export const stylists = [
  {
    id: 1,
    name: "Salma Al-Otaibi",
    category: "Hair",
    specialty: "Hair Coloring & Styling",
    rating: 4.9,
    reviews: 124,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60"
  }
];

// 2. Full clients list with their timelines and beauty passports
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

// 3. Complete appointments logs
export const appointments = [
  { id: "a1", clientId: "c1", client: "Nour Al-Faisal", service: "Root color 7.3", date: "2026-07-19", time: "10:00", location: "Al Narjis, Riyadh", status: "confirmed", travelMinFromPrev: 0, distanceKmFromPrev: 0 },
  { id: "a2", clientId: "c2", service: "Bridal trial run-through", client: "Rana Bakhsh", date: "2026-07-19", time: "13:30", location: "Al Malqa, Riyadh", status: "confirmed", travelMinFromPrev: 22, distanceKmFromPrev: 14.2 },
  { id: "a5", clientId: "c3", client: "Dana Al-Qahtani", service: "Blowout", date: "2026-07-19", time: "16:30", location: "Hittin, Riyadh", status: "confirmed", travelMinFromPrev: 18, distanceKmFromPrev: 9.6 },
  { id: "a3", clientId: "c3", client: "Dana Al-Qahtani", service: "Henna touch-up", date: "2026-07-20", time: "16:00", location: "Hittin, Riyadh", status: "pending", travelMinFromPrev: 0, distanceKmFromPrev: 0 },
  { id: "a4", clientId: "c1", client: "Nour Al-Faisal", service: "Blowout", date: "2026-07-22", time: "09:00", location: "Al Narjis, Riyadh", status: "confirmed", travelMinFromPrev: 0, distanceKmFromPrev: 0 },
];

// 4. Financial breakdown (fixing the current error!)
export const revenueByMonth = [
  { month: "Feb", revenue: 4200, expenses: 900 },
  { month: "Mar", revenue: 5100, expenses: 1100 },
  { month: "Apr", revenue: 4800, expenses: 950 },
  { month: "May", revenue: 6200, expenses: 1300 },
  { month: "Jun", revenue: 7100, expenses: 1450 },
  { month: "Jul", revenue: 5600, expenses: 1200 },
];

// 5. App platform core modules
export const engines = [
  {
    id: "appointments",
    name: "Appointment Engine",
    tagline: "Booking, calendar, waiting list, reminders",
    color: "wine",
  },
  {
    id: "passport",
    name: "Beauty Memory Engine",
    tagline: "The Beauty Passport — every client, remembered",
    color: "gold",
    starred: true,
  },
  {
    id: "route",
    name: "Route Engine",
    tagline: "Smart routing, traffic, fuel estimation",
    color: "sage",
  },
  {
    id: "business",
    name: "Business Engine",
    tagline: "Revenue, expenses, reports, analytics",
    color: "gold",
  },
  {
    id: "ai",
    name: "AI Engine",
    tagline: "Face analysis, hair recommendation, AI coach",
    color: "wine",
  },
  {
    id: "salon",
    name: "Salon Engine",
    tagline: "Staff, POS, inventory, commission",
    color: "sage",
  },
];