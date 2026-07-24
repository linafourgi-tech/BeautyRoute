// Bilingual (EN/AR) helper for BeautyRoute. Business logic only — no styling.
// Consumers keep the active language in their own state; call setDir on change.
export const STRINGS = {
  book: { en: "Book appointment", ar: "احجز موعد" },
  bookAgain: { en: "Book again", ar: "احجز مرة أخرى" },
  discover: { en: "Discover", ar: "اكتشفي" },
  search: { en: "Search styles, salons, services", ar: "ابحثي عن تسريحات، صالونات، خدمات" },
  bookings: { en: "Bookings", ar: "الحجوزات" },
  passport: { en: "Beauty Passport", ar: "جواز الجمال" },
  favorites: { en: "Favorites", ar: "المفضلة" },
  today: { en: "Today", ar: "اليوم" },
  womensBeauty: { en: "Women's Beauty", ar: "جمال المرأة" },
  mensGrooming: { en: "Men's Grooming", ar: "العناية بالرجل" },
  atSalon: { en: "At the salon", ar: "في الصالون" },
  atMyLocation: { en: "At my location", ar: "في موقعي" },
  save: { en: "Save changes", ar: "حفظ التغييرات" },
};
export function t(key, lang) { return (STRINGS[key] && STRINGS[key][lang]) || key; }
export function isRTL(lang) { return lang === "ar"; }
// Localized dates/numbers via Intl — Arabic uses ar-SA (Umm al-Qura calendar-aware locale).
export function formatDate(date, lang) {
  const loc = lang === "ar" ? "ar-SA" : "en-GB";
  return new Intl.DateTimeFormat(loc, { weekday: "short", day: "numeric", month: "short" }).format(date);
}
export function formatTime(date, lang) {
  const loc = lang === "ar" ? "ar-SA" : "en-GB";
  return new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit" }).format(date);
}
export function formatSAR(amount, lang) {
  const loc = lang === "ar" ? "ar-SA" : "en-GB";
  return new Intl.NumberFormat(loc, { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
}
// Direction-implying icons should mirror in RTL; decorative/symmetric ones should not.
export function iconFlip(lang) { return lang === "ar" ? "scaleX(-1)" : "none"; }

// ── Per-user language model ─────────────────────────────────────────────
// Each authenticated user (client AND professional, independently) has ONE
// language preference stored on their profile. It does NOT change because the
// other party in a booking speaks another language — a client booking with an
// Arabic-speaking pro still sees English if that's their preference, and vice
// versa. Persist on change, restore on login, and apply dir automatically.
//
// Only UI/system text follows the preference: navigation, buttons, forms,
// notifications, email/SMS/WhatsApp templates, and AI responses (default to the
// user's language unless they ask otherwise). User-generated content does NOT:
// service names/descriptions are authored per-language (show the available one,
// never machine-translate), reviews stay in their written language, photos are
// language-agnostic.
const LANG_KEY = "br.user.lang"; // in production: persisted on the user profile row, not just localStorage
export function loadUserLang(fallback = "en") {
  try { return localStorage.getItem(LANG_KEY) || fallback; } catch (e) { return fallback; }
}
export function saveUserLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  applyDir(lang);
  return lang;
}
export function applyDir(lang) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
  }
}
// Pick the right side of a bilingual UGC field: { en, ar }. Falls back to the
// other language when the preferred one is empty — never an empty string.
export function pickLocalized(field, lang) {
  if (!field) return "";
  if (typeof field === "string") return field;
  return field[lang] || field.en || field.ar || "";
}
