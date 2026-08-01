/* BeautyRoute runtime i18n — plain (non-module) mirror of assets/i18n.js so the
   babel screen scripts can consume it via a normal <script> tag. Exposes window.BRI18N.
   One active language per user; UI chrome is localized, UGC is not. */
(function () {
  var S = {
    // ── Navigation ──
    "nav.discover":   { en: "Discover",         ar: "اكتشفي" },
    "nav.matches":    { en: "Matches",          ar: "المطابقات" },
    "nav.bookings":   { en: "Bookings",         ar: "الحجوزات" },
    "nav.favorites":  { en: "Favorites",        ar: "المفضلة" },
    "nav.ai":         { en: "AI Consultation",  ar: "استشارة ذكية" },
    // ── Buttons / CTAs ──
    "cta.bookNow":    { en: "Book now",             ar: "احجزي الآن" },
    "cta.book":       { en: "Book appointment",     ar: "تأكيد الحجز" },
    "cta.bookAgain":  { en: "Book again",           ar: "احجزي مجددًا" },
    "cta.viewProfile":{ en: "View profile",         ar: "عرض الملف" },
    "cta.startAI":    { en: "Start AI consultation",ar: "ابدئي الاستشارة الذكية" },
    "cta.change":     { en: "Change",               ar: "تغيير" },
    // ── Search / experience ──
    "search.placeholder": { en: "Search styles, salons, services", ar: "ابحثي عن تسريحات، صالونات، خدمات" },
    // ── Category tags (chrome) ──
    "tag.All":          { en: "All",           ar: "الكل" },
    "tag.Balayage":     { en: "Balayage",      ar: "بالياج" },
    "tag.Curly":        { en: "Curly",         ar: "شعر مجعّد" },
    "tag.Bob":          { en: "Bob",           ar: "قصّة بوب" },
    "tag.Updo":         { en: "Updo",          ar: "شعر مرفوع" },
    "tag.Bridal":       { en: "Bridal",        ar: "عرائس" },
    "tag.Fade":         { en: "Fade",          ar: "تدريج" },
    "tag.Beard":        { en: "Beard",         ar: "لحية" },
    "tag.Textured crop":{ en: "Textured crop", ar: "قصّة نصّية" },
    "tag.Scalp care":   { en: "Scalp care",    ar: "عناية بفروة الرأس" },
    "tag.Color":        { en: "Color",         ar: "صبغة" },
    "tag.Hair":         { en: "Hair",          ar: "شعر" },
    "tag.Makeup":       { en: "Makeup",        ar: "مكياج" },
    "tag.Nails":        { en: "Nails",         ar: "أظافر" },
    "tag.Barber":       { en: "Barber",        ar: "حلاقة" },
    // ── Favorites ──
    "fav.available":  { en: "Available this week", ar: "متاحة هذا الأسبوع" },
    // ── Matches ──
    "match.matchedTo":{ en: "Matched to",  ar: "مطابق لـ" },
    "match.title":    { en: "Professionals with real work in this style", ar: "محترفات لديهنّ أعمال حقيقية بهذا الأسلوب" },
    "match.subtitle": { en: "Every portfolio below was uploaded by the artist themselves.", ar: "كل معرض أعمال بالأسفل رفعته صاحبته بنفسها." },
    // ── Bookings ──
    "bookings.upcoming": { en: "Upcoming", ar: "القادمة" },
    "bookings.past":     { en: "Past",     ar: "السابقة" },
    "bookings.confirmed":{ en: "confirmed",ar: "مؤكد" },
    "bookings.pending":  { en: "pending",  ar: "قيد الانتظار" },
    // ── AI consult ──
    "ai.emptyTitle":  { en: "Not sure what style suits you?", ar: "غير متأكدة من الأسلوب المناسب لكِ؟" },
    "ai.emptyBody":   { en: "Answer a few quick questions and get matched with styles suited to your face shape and hair type.", ar: "أجيبي عن أسئلة سريعة ودعينا نطابقك بأساليب تناسب شكل وجهك ونوع شعرك." },
    "ai.resultsTitle":{ en: "Based on your answers", ar: "بناءً على إجاباتك" },
    // ── Booking screen ──
    "book.eyebrow":   { en: "Confirm your appointment", ar: "أكّدي موعدك" },
    "book.when":      { en: "When",  ar: "الموعد" },
    "book.where":     { en: "Where", ar: "المكان" },
    "book.date":      { en: "Date",  ar: "التاريخ" },
    "book.time":      { en: "Time",  ar: "الوقت" },
    "book.bookingAs": { en: "Booking as", ar: "الحجز باسم" },
    "book.total":     { en: "Total", ar: "الإجمالي" },
    "book.travel":    { en: "travel", ar: "تنقّل" },
    "book.freeCancel":{ en: "Free cancellation up to 24 hours before", ar: "إلغاء مجاني حتى ٢٤ ساعة قبل الموعد" },
  };
  // Units / patterns that need a value spliced in.
  var P = {
    reviews:  { en: function (n) { return n + " reviews"; }, ar: function (n) { return n + " تقييم"; } },
    minutes:  { en: function (n) { return n + " min";     }, ar: function (n) { return n + " دقيقة"; } },
    pieces:   { en: function (n) { return n + " portfolio pieces"; }, ar: function (n) { return n + " عمل بالمعرض"; } },
  };
  function t(key, lang) { var e = S[key]; return (e && (e[lang] || e.en)) || key; }
  function p(key, lang, n) { var e = P[key]; return e ? (e[lang] || e.en)(n) : String(n); }
  function isRTL(lang) { return lang === "ar"; }
  function dir(lang) { return isRTL(lang) ? "rtl" : "ltr"; }
  function loc(lang) { return lang === "ar" ? "ar-SA" : "en-GB"; }
  function formatDate(date, lang) {
    return new Intl.DateTimeFormat(loc(lang), { weekday: "short", day: "numeric", month: "short" }).format(date);
  }
  function formatTime(date, lang) {
    return new Intl.DateTimeFormat(loc(lang), { hour: "numeric", minute: "2-digit" }).format(date);
  }
  function formatSAR(amount, lang) {
    return new Intl.NumberFormat(loc(lang), { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
  }
  function applyDir(lang) {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir(lang);
    }
  }
  // UGC picker: bilingual field { en, ar } → show preferred, fall back to the other. Never machine-translate.
  function pickLocalized(field, lang) {
    if (!field) return "";
    if (typeof field === "string") return field;
    return field[lang] || field.en || field.ar || "";
  }
  window.BRI18N = { S: S, t: t, p: p, isRTL: isRTL, dir: dir, formatDate: formatDate, formatTime: formatTime, formatSAR: formatSAR, applyDir: applyDir, pickLocalized: pickLocalized };
})();
