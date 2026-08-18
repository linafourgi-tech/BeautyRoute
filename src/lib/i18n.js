// Real translation module for BeautyRoute's authenticated product UI.
//
// Root cause this exists (see the design-refinement report for full detail):
// the app shipped with per-nav-item label/labelAr pairs (Sidebar) and a
// title/titleAr pair on Layout, but nothing that actually chose ONE based on
// a language, and virtually every other string in every page (stat labels,
// section headings, empty states, buttons, dialogs, validation messages) was
// hardcoded English with no Arabic counterpart at all. The design reference
// ships its own i18n.js/i18n.global.js with the same t(key, lang) shape this
// module uses -- that pattern is reused deliberately, not reinvented, but
// its STRINGS dictionary is for the reference's client-booking flow, not
// BeautyRoute's real professional-side pages, so a new dictionary covering
// this app's actual UI was the technically-necessary minimum here.
//
// Which language is active is decided elsewhere (lib/locale.js's
// resolveWorkspaceLang(), backed by the real workspaces.locale column) --
// this module only answers "given a language, what string do I show."

export function isRTL(lang) {
  return lang === "ar";
}

export function dirFor(lang) {
  return isRTL(lang) ? "rtl" : "ltr";
}

// Locale tag for native Intl formatting (dates/numbers/currency) -- ar-SA
// for Arabic, matching the design reference's own choice (Umm al-Qura-aware,
// Riyadh-facing), en-GB for English (day-before-month, matches every
// existing toLocaleDateString("en-GB") call already in this codebase).
export function intlLocale(lang) {
  return isRTL(lang) ? "ar-SA" : "en-GB";
}

const STRINGS = {
  // ---- Sidebar (account footer / workspace switcher; nav items keep their
  // own label/labelAr pairs in Sidebar.jsx, unrelated to this dictionary) ----
  "sidebar.workspace": { en: "Workspace", ar: "مساحة العمل" },
  "sidebar.workspaceLoading": { en: "Loading workspace…", ar: "جارٍ تحميل مساحة العمل…" },
  "sidebar.workspaceError": { en: "Couldn't load workspaces", ar: "تعذّر تحميل مساحات العمل" },
  "sidebar.switchWorkspace": { en: "Switch workspace", ar: "تبديل مساحة العمل" },
  "sidebar.yourAccount": { en: "Your account", ar: "حسابك" },
  "sidebar.noWorkspace": { en: "No workspace yet", ar: "لا توجد مساحة عمل بعد" },
  "sidebar.logOut": { en: "Log out", ar: "تسجيل الخروج" },
  "sidebar.signOutError": { en: "Couldn't sign out. Please try again.", ar: "تعذّر تسجيل الخروج. يرجى المحاولة مرة أخرى." },
  "sidebar.openNav": { en: "Open navigation", ar: "فتح القائمة" },
  "sidebar.closeNav": { en: "Close navigation", ar: "إغلاق القائمة" },
  "sidebar.navLabel": { en: "Navigation", ar: "التنقل" },
  "sidebar.switchTo": { en: "Switch to", ar: "التبديل إلى" },
  "sidebar.switching": { en: "Switching…", ar: "جارٍ التبديل…" },
  "action.switchLanguageError": { en: "Couldn't switch language.", ar: "تعذّر تبديل اللغة." },

  // ---- Trial banner ----
  "trial.ended": { en: "Your trial has ended.", ar: "انتهت الفترة التجريبية." },
  "trial.daysLeft": {
    en: (v) => `Your free trial ends in ${v.days} day${v.days === 1 ? "" : "s"}.`,
    ar: (v) => `تنتهي فترتك التجريبية المجانية خلال ${v.days} ${v.days === 1 ? "يوم" : "أيام"}.`,
  },
  "trial.upgradeNow": { en: "Upgrade Now", ar: "الترقية الآن" },
  "trial.viewPlans": { en: "View plans", ar: "عرض الخطط" },

  // ---- Shared: appointment/booking status values (Dashboard, Appointments,
  // Beauty Passport all display the same underlying status column) ----
  "status.confirmed": { en: "confirmed", ar: "مؤكد" },
  "status.completed": { en: "completed", ar: "مكتمل" },
  "status.pending": { en: "pending", ar: "قيد الانتظار" },
  "status.cancelled": { en: "cancelled", ar: "ملغى" },
  "status.noshow": { en: "noshow", ar: "لم يحضر" },

  // ---- Shared: service categories (Services page grouping + New booking's
  // service picker both surface these -- display-only, the stored category
  // value is unchanged) ----
  "category.consultation": { en: "consultation", ar: "استشارة" },
  "category.haircut": { en: "haircut", ar: "قص شعر" },
  "category.styling": { en: "styling", ar: "تصفيف" },
  "category.color": { en: "color", ar: "صبغة" },
  "category.treatment": { en: "treatment", ar: "علاج" },
  "category.extensions": { en: "extensions", ar: "وصلات" },
  "category.bridal": { en: "bridal", ar: "عروس" },
  "category.specialty": { en: "specialty", ar: "خدمة متخصصة" },

  // ---- Shared: client tiers (Clients page, display-only -- stored value
  // unchanged) ----
  "tier.Bronze": { en: "Bronze", ar: "برونزي" },
  "tier.Silver": { en: "Silver", ar: "فضي" },
  "tier.Gold": { en: "Gold", ar: "ذهبي" },
  "tier.Platinum": { en: "Platinum", ar: "بلاتيني" },

  // ---- Shared: generic actions/labels reused across several pages ----
  "action.cancel": { en: "Cancel", ar: "إلغاء" },
  "action.save": { en: "Save", ar: "حفظ" },
  "action.saving": { en: "Saving…", ar: "جارٍ الحفظ…" },
  "action.edit": { en: "Edit", ar: "تعديل" },
  "action.delete": { en: "Delete", ar: "حذف" },
  "action.deleting": { en: "Deleting…", ar: "جارٍ الحذف…" },
  "action.working": { en: "Working…", ar: "جارٍ التنفيذ…" },
  "action.neverMind": { en: "Never mind", ar: "تراجع" },

  // ---- Dashboard ----
  "dashboard.greeting": { en: (v) => (v?.name ? `Good to see you, ${v.name}` : "Good to see you"), ar: () => "أهلاً بك" },
  "dashboard.searchPlaceholder": { en: "Search clients…", ar: "ابحث عن عميلة…" },
  "dashboard.clearSearch": { en: "Clear search", ar: "مسح البحث" },
  "dashboard.noClientMatch": { en: (v) => `No client matches "${v.query}".`, ar: (v) => `لا توجد عميلة تطابق "${v.query}".` },
  "dashboard.lastVisit": { en: (v) => `Last visit ${v.date}`, ar: (v) => `آخر زيارة ${v.date}` },
  "dashboard.stat.appointmentsToday": { en: "appointments today", ar: "مواعيد اليوم" },
  "dashboard.stat.activePassports": { en: "active client passports", ar: "جوازات العميلات النشطة" },
  "dashboard.stat.revenueThisMonth": { en: "revenue this month", ar: "الإيرادات هذا الشهر" },
  "dashboard.stat.averageRating": { en: "average client rating", ar: "متوسط تقييم العميلات" },
  "dashboard.notAvailable": { en: "Not available", ar: "غير متاح" },
  "dashboard.today": { en: "Today", ar: "اليوم" },
  "dashboard.fullMap": { en: "Full map", ar: "الخريطة الكاملة" },
  "dashboard.emptyTitle": { en: "No visits scheduled today", ar: "لا توجد زيارات مجدولة اليوم" },
  "dashboard.emptyDescription": { en: "Enjoy the quiet — today's bookings will show up here.", ar: "استمتعي بالهدوء — ستظهر حجوزات اليوم هنا." },
  "dashboard.moreStops": { en: (v) => ` and ${v.count} more stop${v.count === 1 ? "" : "s"} today`, ar: (v) => ` و${v.count} ${v.count === 1 ? "توقف آخر" : "توقفات أخرى"} اليوم` },
  "dashboard.errorFallback": { en: "Couldn't load your dashboard.", ar: "تعذّر تحميل لوحة التحكم." },

  // ---- Appointments ----
  "appointments.title": { en: "Appointment Engine", ar: "محرك المواعيد" },
  "appointments.subtitle": { en: "Booking, calendar, waiting list, cancellations and reminders — all in one thread.", ar: "الحجوزات والتقويم وقائمة الانتظار والإلغاءات والتذكيرات — كل ذلك في مكان واحد." },
  "appointments.newBooking": { en: "New booking", ar: "حجز جديد" },
  "appointments.emptyTitle": { en: "Nothing booked yet", ar: "لا توجد حجوزات بعد" },
  "appointments.emptyDescription": { en: "Appointments booked for this day will show up here.", ar: "ستظهر هنا مواعيد هذا اليوم عند حجزها." },
  "appointments.travelPlaceholder": { en: "~45 min", ar: "~٤٥ دقيقة" },
  "appointments.comingSoon": {
    en: "Coming to this engine: waiting-list auto-fill when a slot cancels, peak-day pricing suggestions, and WhatsApp-native reminders sent 24h and 2h before each visit.",
    ar: "قادم إلى هذا المحرك: تعبئة تلقائية لقائمة الانتظار عند إلغاء موعد، اقتراحات تسعير لأيام الذروة، وتذكيرات عبر واتساب تُرسل قبل كل زيارة بـ٢٤ و٢ ساعة.",
  },
  "appointments.editBooking": { en: "Edit booking", ar: "تعديل الحجز" },
  "appointments.newBookingTitle": { en: "New booking", ar: "حجز جديد" },
  "appointments.saveChanges": { en: "Save changes", ar: "حفظ التغييرات" },
  "appointments.bookAppointment": { en: "Book appointment", ar: "احجز الموعد" },
  "appointments.client": { en: "Client", ar: "العميلة" },
  "appointments.selectClient": { en: "Select a client…", ar: "اختاري عميلة…" },
  "appointments.date": { en: "Date", ar: "التاريخ" },
  "appointments.startTime": { en: "Start time", ar: "وقت البدء" },
  "appointments.services": { en: "Services", ar: "الخدمات" },
  "appointments.noActiveServices": { en: "No active services yet.", ar: "لا توجد خدمات نشطة بعد." },
  "appointments.status": { en: "Status", ar: "الحالة" },
  "appointments.location": { en: "Location", ar: "الموقع" },
  "appointments.locationPlaceholder": { en: "Al Narjis, Riyadh", ar: "النرجس، الرياض" },
  "appointments.validation.client": { en: "Select a client.", ar: "اختاري عميلة." },
  "appointments.validation.date": { en: "Pick a date.", ar: "اختاري تاريخًا." },
  "appointments.validation.time": { en: "Pick a start time.", ar: "اختاري وقت البدء." },
  "appointments.cancelTitle": { en: "Cancel this appointment?", ar: "هل تريدين إلغاء هذا الموعد؟" },
  "appointments.cancelBody": { en: (v) => `${v.client} at ${v.time} will be marked as cancelled.`, ar: (v) => `سيتم وضع علامة "ملغى" على موعد ${v.client} الساعة ${v.time}.` },
  "appointments.cancelBooking": { en: "Cancel booking", ar: "إلغاء الحجز" },
  "appointments.deleteTitle": { en: "Delete this appointment?", ar: "هل تريدين حذف هذا الموعد؟" },
  "appointments.deleteBody": { en: (v) => `This permanently removes ${v.client}'s booking at ${v.time}. This can't be undone.`, ar: (v) => `سيتم حذف حجز ${v.client} الساعة ${v.time} نهائيًا. لا يمكن التراجع عن هذا الإجراء.` },
  "appointments.errorFallback": { en: "Couldn't load your appointments.", ar: "تعذّر تحميل مواعيدك." },
  "appointments.saveErrorFallback": { en: "Couldn't save this appointment.", ar: "تعذّر حفظ هذا الموعد." },
  "appointments.cancelErrorFallback": { en: "Couldn't cancel this appointment.", ar: "تعذّر إلغاء هذا الموعد." },
  "appointments.deleteErrorFallback": { en: "Couldn't delete this appointment.", ar: "تعذّر حذف هذا الموعد." },

  // ---- Clients ----
  "clients.title": { en: "Clients", ar: "العملاء" },
  "clients.subtitleLoading": { en: "Everyone you've worked with, in one place.", ar: "كل من تعاملتِ معهنّ، في مكان واحد." },
  "clients.subtitle": {
    en: (v) => `${v.count} client${v.count === 1 ? "" : "s"} · everyone you've worked with, in one place.`,
    ar: (v) => `${v.count} ${v.count === 1 ? "عميلة" : "عميلات"} · كل من تعاملتِ معهنّ، في مكان واحد.`,
  },
  "clients.searchPlaceholder": { en: "Search clients…", ar: "ابحث عن عميلة…" },
  "clients.newClient": { en: "New client", ar: "عميلة جديدة" },
  "clients.emptySearchTitle": { en: "No clients match your search", ar: "لا توجد عميلات مطابقة لبحثك" },
  "clients.emptySearchDescription": { en: "Try a different name, phone, or email.", ar: "جرّبي اسمًا أو رقم هاتف أو بريدًا إلكترونيًا آخر." },
  "clients.emptyTitle": { en: "No clients yet", ar: "لا توجد عميلات بعد" },
  "clients.emptyDescription": { en: "Add your first client to get started.", ar: "أضيفي أول عميلة للبدء." },
  "clients.addClient": { en: "Add a client", ar: "إضافة عميلة" },
  "clients.noContactInfo": { en: "No contact info on file", ar: "لا توجد بيانات تواصل مسجلة" },
  "clients.passport": { en: "Passport", ar: "الجواز" },
  "clients.editClient": { en: "Edit client", ar: "تعديل العميلة" },
  "clients.newClientTitle": { en: "New client", ar: "عميلة جديدة" },
  "clients.fullName": { en: "Full name", ar: "الاسم الكامل" },
  "clients.phone": { en: "Phone", ar: "الهاتف" },
  "clients.email": { en: "Email", ar: "البريد الإلكتروني" },
  "clients.tier": { en: "Tier", ar: "الفئة" },
  "clients.notes": { en: "Notes", ar: "ملاحظات" },
  "clients.notesHint": { en: "Private -- visible only to your team", ar: "خاص -- مرئي لفريقك فقط" },
  "clients.validation.fullName": { en: "Full name is required.", ar: "الاسم الكامل مطلوب." },
  "clients.deleteTitle": { en: "Delete client?", ar: "هل تريدين حذف العميلة؟" },
  "clients.deleteBody": { en: (v) => `This will permanently remove ${v.name}. This can't be undone.`, ar: (v) => `سيتم حذف ${v.name} نهائيًا. لا يمكن التراجع عن هذا الإجراء.` },
  "clients.deleteBlocked": { en: "This client has appointment or visit history and can't be deleted.", ar: "لا يمكن حذف هذه العميلة لأن لديها مواعيد أو زيارات مسجلة." },
  "clients.errorFallback": { en: "Couldn't load clients.", ar: "تعذّر تحميل العملاء." },
  "clients.saveErrorFallback": { en: "Couldn't save this client.", ar: "تعذّر حفظ بيانات العميلة." },
  "clients.deleteErrorFallback": { en: "Couldn't delete this client.", ar: "تعذّر حذف العميلة." },

  // ---- Services ----
  "services.title": { en: "Services", ar: "الخدمات" },
  "services.subtitleLoading": { en: "What you offer, and what it costs.", ar: "ما تقدّمينه، وتكلفته." },
  "services.subtitle": {
    en: (v) => `${v.count} service${v.count === 1 ? "" : "s"} · what you offer, and what it costs.`,
    ar: (v) => `${v.count} ${v.count === 1 ? "خدمة" : "خدمات"} · ما تقدّمينه، وتكلفته.`,
  },
  "services.importTemplates": { en: "Import templates", ar: "استيراد قوالب" },
  "services.newService": { en: "New service", ar: "خدمة جديدة" },
  "services.emptyTitle": { en: "No services yet", ar: "لا توجد خدمات بعد" },
  "services.emptyDescription": { en: "Create your own, or import from the starter catalog to get going fast.", ar: "أنشئي خدماتك الخاصة، أو استوردي من الكتالوج الجاهز للبدء بسرعة." },
  "services.durationPrice": { en: (v) => `${v.duration} min · SAR ${v.price}`, ar: (v) => `${v.duration} دقيقة · ${v.price} ر.س` },
  "services.active": { en: "Active", ar: "نشطة" },
  "services.editService": { en: "Edit service", ar: "تعديل الخدمة" },
  "services.newServiceTitle": { en: "New service", ar: "خدمة جديدة" },
  "services.serviceName": { en: "Service name", ar: "اسم الخدمة" },
  "services.category": { en: "Category", ar: "الفئة" },
  "services.durationMinutes": { en: "Duration (minutes)", ar: "المدة (دقائق)" },
  "services.priceSAR": { en: "Price (SAR)", ar: "السعر (ر.س)" },
  "services.validation.name": { en: "Service name is required.", ar: "اسم الخدمة مطلوب." },
  "services.validation.duration": { en: "Duration must be a positive number of minutes.", ar: "يجب أن تكون المدة رقمًا موجبًا من الدقائق." },
  "services.validation.price": { en: "Price can't be negative.", ar: "لا يمكن أن يكون السعر سالبًا." },
  "services.deleteTitle": { en: "Delete service?", ar: "هل تريدين حذف الخدمة؟" },
  "services.deleteBody": { en: (v) => `This will permanently remove "${v.name}". This can't be undone.`, ar: (v) => `سيتم حذف "${v.name}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.` },
  "services.deleteBlocked": { en: "This service has been booked before and can't be deleted -- try disabling it instead.", ar: "لا يمكن حذف هذه الخدمة لأنها حُجزت من قبل -- جرّبي تعطيلها بدلًا من ذلك." },
  "services.importTitle": { en: "Import service templates", ar: "استيراد قوالب الخدمات" },
  "services.importing": { en: "Importing…", ar: "جارٍ الاستيراد…" },
  "services.import": { en: (v) => `Import ${v.count || ""}`.trim(), ar: (v) => `استيراد ${v.count || ""}`.trim() },
  "services.allTemplatesAdded": { en: "You've already added every starter template.", ar: "لقد أضفتِ جميع القوالب الجاهزة بالفعل." },
  "services.errorFallback": { en: "Couldn't load services.", ar: "تعذّر تحميل الخدمات." },
  "services.saveErrorFallback": { en: "Couldn't save this service.", ar: "تعذّر حفظ الخدمة." },
  "services.updateErrorFallback": { en: "Couldn't update this service.", ar: "تعذّر تحديث الخدمة." },
  "services.deleteErrorFallback": { en: "Couldn't delete this service.", ar: "تعذّر حذف الخدمة." },
  "services.templatesErrorFallback": { en: "Couldn't load service templates.", ar: "تعذّر تحميل قوالب الخدمات." },
  "services.importErrorFallback": { en: "Couldn't import those templates.", ar: "تعذّر استيراد هذه القوالب." },

  // ---- Beauty Passport ----
  "passport.title": { en: "Beauty Passport", ar: "جواز الجمال" },
  "passport.subtitle": { en: "Every client's story, remembered — a chronological record of formulas, looks, and notes.", ar: "قصة كل عميلة، محفوظة — سجل زمني للتركيبات والإطلالات والملاحظات." },
  "passport.searchPlaceholder": { en: "Search clients…", ar: "ابحث عن عميلة…" },
  "passport.loadingClients": { en: "Loading clients…", ar: "جارٍ تحميل العميلات…" },
  "passport.noClientsYet": { en: "No clients yet — add one from the Clients page.", ar: "لا توجد عميلات بعد — أضيفي واحدة من صفحة العملاء." },
  "passport.lastVisit": { en: (v) => `Last visit ${v.date}`, ar: (v) => `آخر زيارة ${v.date}` },
  "passport.noVisitsYet": { en: "No visits yet", ar: "لا توجد زيارات بعد" },
  "passport.eyebrow": { en: "Beauty Passport", ar: "جواز الجمال" },
  "passport.clientSince": { en: (v) => `Client since ${v.date}`, ar: (v) => `عميلة منذ ${v.date}` },
  "passport.phone": { en: "Phone", ar: "الهاتف" },
  "passport.email": { en: "Email", ar: "البريد الإلكتروني" },
  "passport.allergies": { en: "Allergies", ar: "الحساسية" },
  "passport.notes": { en: "Notes", ar: "ملاحظات" },
  "passport.notOnFile": { en: "Not on file", ar: "غير مسجل" },
  "passport.noneOnFile": { en: "None on file", ar: "لا يوجد" },
  "passport.noInternalNotes": { en: "No internal notes", ar: "لا توجد ملاحظات داخلية" },
  "passport.generateSummary": { en: "Generate summary", ar: "إنشاء ملخص" },
  "passport.suggestNextVisit": { en: "Suggest next visit", ar: "اقتراح الزيارة القادمة" },
  "passport.appointmentHistory": { en: "Appointment history", ar: "سجل المواعيد" },
  "passport.noAppointmentsYet": { en: "No appointments booked yet.", ar: "لا توجد مواعيد محجوزة بعد." },
  "passport.noServicesOnFile": { en: "No services on file", ar: "لا توجد خدمات مسجلة" },
  "passport.herStorySoFar": { en: "Her story so far", ar: "قصتها حتى الآن" },
  "passport.logVisit": { en: "Log a visit", ar: "تسجيل زيارة" },
  "passport.noVisitsLogged": { en: "No visits logged yet — log the first one above.", ar: "لا توجد زيارات مسجلة بعد — سجّلي الأولى أعلاه." },
  "passport.noLinkedServices": { en: "No linked services", ar: "لا توجد خدمات مرتبطة" },
  "passport.youSuffix": { en: " · You", ar: " · أنتِ" },
  "passport.field.services": { en: "Services", ar: "الخدمات" },
  "passport.field.notes": { en: "Notes", ar: "ملاحظات" },
  "passport.field.photos": { en: "Photos", ar: "الصور" },
  "passport.field.formula": { en: "Formula", ar: "التركيبة" },
  "passport.field.nextRecommendation": { en: "Next recommendation", ar: "التوصية القادمة" },
  "passport.field.productsUsed": { en: "Products used", ar: "المنتجات المستخدمة" },
  "passport.noNotesOnFile": { en: "No notes on file.", ar: "لا توجد ملاحظات مسجلة." },
  "passport.noPhotosOnFile": { en: "No photos on file.", ar: "لا توجد صور مسجلة." },
  "passport.editThisVisit": { en: "Edit this visit", ar: "تعديل هذه الزيارة" },
  "passport.generateAftercare": { en: "Generate aftercare", ar: "إنشاء تعليمات العناية" },
  "passport.editVisitTitle": { en: "Edit visit", ar: "تعديل الزيارة" },
  "passport.logVisitTitle": { en: "Log a visit", ar: "تسجيل زيارة" },
  "passport.logVisitAction": { en: "Log visit", ar: "تسجيل الزيارة" },
  "passport.visitDate": { en: "Visit date", ar: "تاريخ الزيارة" },
  "passport.linkedAppointment": { en: "Linked appointment (optional -- determines services shown & duration)", ar: "الموعد المرتبط (اختياري -- يحدد الخدمات والمدة الظاهرة)" },
  "passport.noLinkedAppointment": { en: "No linked appointment", ar: "لا يوجد موعد مرتبط" },
  "passport.noServicesLabel": { en: "no services", ar: "لا توجد خدمات" },
  "passport.productsUsedCsv": { en: "Products used (comma separated)", ar: "المنتجات المستخدمة (مفصولة بفواصل)" },
  "passport.formula": { en: "Formula", ar: "التركيبة" },
  "passport.formulaPlaceholder": { en: "e.g. 7.3 + 20vol, 30min", ar: "مثال: 7.3 + 20vol، 30 دقيقة" },
  "passport.nextRecommendation": { en: "Next recommendation", ar: "التوصية القادمة" },
  "passport.nextRecommendationPlaceholder": { en: "e.g. Gloss refresh in 6 weeks", ar: "مثال: تجديد اللمعان خلال 6 أسابيع" },
  "passport.beforePhotoUrl": { en: "Before photo URL (optional)", ar: "رابط صورة قبل (اختياري)" },
  "passport.afterPhotoUrl": { en: "After photo URL (optional)", ar: "رابط صورة بعد (اختياري)" },
  "passport.validation.visitDate": { en: "Pick a visit date.", ar: "اختاري تاريخ الزيارة." },
  "passport.clientsErrorFallback": { en: "Couldn't load clients.", ar: "تعذّر تحميل العملاء." },
  "passport.detailErrorFallback": { en: "Couldn't load this passport.", ar: "تعذّر تحميل هذا الجواز." },
  "passport.saveVisitErrorFallback": { en: "Couldn't save this visit.", ar: "تعذّر حفظ هذه الزيارة." },
  "passport.ai.summaryTitle": { en: "Client summary", ar: "ملخص العميلة" },
  "passport.ai.nextVisitTitle": { en: "Next visit suggestion", ar: "اقتراح الزيارة القادمة" },
  "passport.ai.aftercareTitle": { en: "Aftercare instructions", ar: "تعليمات العناية اللاحقة" },
  "passport.ai.generating": { en: "Generating…", ar: "جارٍ الإنشاء…" },
  "passport.ai.medicalWarning": { en: "This is AI-generated general guidance, not medical advice. Review it carefully before sharing it with your client.", ar: "هذا إرشاد عام تم إنشاؤه بالذكاء الاصطناعي وليس نصيحة طبية. راجعيه بعناية قبل مشاركته مع عميلتك." },
  "passport.ai.reviewNote": { en: "AI-generated — nothing here is saved automatically. Review before using it.", ar: "تم إنشاؤه بالذكاء الاصطناعي — لا يُحفظ شيء هنا تلقائيًا. راجعيه قبل استخدامه." },
  "passport.ai.copied": { en: "Copied", ar: "تم النسخ" },
  "passport.ai.copy": { en: "Copy", ar: "نسخ" },
  "passport.ai.genericError": { en: "Something went wrong. Please try again.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },

  // ---- Route Engine ----
  "route.title": { en: "Route Engine", ar: "المسار" },
  "route.subtitle": { en: "Plan today's stops, see estimated travel time, and open the route in your navigation app.", ar: "خططي توقفات اليوم، واطّلعي على وقت التنقل المقدر، وافتحي المسار في تطبيق الملاحة لديك." },
  "route.loading": { en: "Loading…", ar: "جارٍ التحميل…" },
  "route.gatedTitle": { en: "Route Engine is a Professional feature", ar: "محرك المسارات ميزة للخطة الاحترافية" },
  "route.gatedDescription": { en: "Optimize today's stop order automatically and open the shortest path between appointments in your navigation app.", ar: "رتّبي توقفات اليوم تلقائيًا وافتحي أقصر مسار بين المواعيد في تطبيق الملاحة لديك." },
  "route.viewPlans": { en: "View plans", ar: "عرض الخطط" },
  "route.dateLabel": { en: "Date", ar: "التاريخ" },
  "route.startingLocation": { en: "Starting location (optional)", ar: "نقطة الانطلاق (اختياري)" },
  "route.startingLocationPlaceholder": { en: "e.g. home address", ar: "مثال: عنوان المنزل" },
  "route.endingLocation": { en: "Ending location (optional)", ar: "نقطة الوصول (اختياري)" },
  "route.endingLocationPlaceholder": { en: "defaults to last stop", ar: "يفترض آخر توقف افتراضيًا" },
  "route.emptyTitle": { en: "No appointments on this date", ar: "لا توجد مواعيد في هذا التاريخ" },
  "route.emptyDescription": { en: "Pick another date, or check back once appointments are booked.", ar: "اختاري تاريخًا آخر، أو عودي بعد حجز المواعيد." },
  "route.missingAddress": { en: (v) => `Missing an address (${v.count})`, ar: (v) => `عنوان مفقود (${v.count})` },
  "route.missingAddressNote": { en: (v) => `${v.client} · ${v.time} — add an address on this appointment to include it in the route.`, ar: (v) => `${v.client} · ${v.time} — أضيفي عنوانًا لهذا الموعد لتضمينه في المسار.` },
  "route.unresolvedAddress": { en: (v) => `Address couldn't be located (${v.count})`, ar: (v) => `تعذّر تحديد العنوان (${v.count})` },
  "route.unresolvedAddressNote": { en: (v) => `${v.client} · ${v.time} — "${v.address}" wasn't found on the map. Check the address for typos.`, ar: (v) => `${v.client} · ${v.time} — تعذّر العثور على "${v.address}" على الخريطة. تحققي من صحة العنوان.` },
  "route.startUnresolved": { en: "Starting location wasn't found. ", ar: "تعذّر العثور على نقطة الانطلاق. " },
  "route.endUnresolved": { en: "Ending location wasn't found.", ar: "تعذّر العثور على نقطة الوصول." },
  "route.todaysRoute": { en: "Today's route", ar: "مسار اليوم" },
  "route.totalDistance": { en: "Total distance", ar: "المسافة الإجمالية" },
  "route.travelTime": { en: "Travel time", ar: "وقت التنقل" },
  "route.conflictWarning": {
    en: (v) => `${v.count} appointment${v.count > 1 ? "s" : ""} may run late based on estimated travel time.`,
    ar: (v) => `قد ${v.count > 1 ? "تتأخر" : "يتأخر"} ${v.count} ${v.count > 1 ? "مواعيد" : "موعد"} بسبب وقت التنقل المقدر.`,
  },
  "route.orderOptimized": { en: "Estimated best order — a heuristic, not a guaranteed optimum.", ar: "أفضل ترتيب مقدّر — تقريبي وليس مضمونًا." },
  "route.orderScheduled": { en: "Scheduled order (by appointment time).", ar: "الترتيب المجدول (حسب وقت الموعد)." },
  "route.calculating": { en: "Calculating…", ar: "جارٍ الحساب…" },
  "route.optimizeRoute": { en: "Optimize route", ar: "تحسين المسار" },
  "route.resetOrder": { en: "Reset order", ar: "إعادة ضبط الترتيب" },
  "route.openInNavigation": { en: "Open in navigation", ar: "فتح في تطبيق الملاحة" },
  "route.moveUp": { en: "Move up", ar: "تحريك لأعلى" },
  "route.moveDown": { en: "Move down", ar: "تحريك لأسفل" },
  "route.loadErrorFallback": { en: "Couldn't load the route for this date.", ar: "تعذّر تحميل المسار لهذا التاريخ." },
  "route.rerouteErrorFallback": { en: "Couldn't recalculate the route.", ar: "تعذّر إعادة حساب المسار." },
  "route.notConfigured": { en: "Map isn't configured yet — ask your workspace owner to set up the maps provider.", ar: "لم يتم إعداد الخريطة بعد — اطلبي من مالك مساحة العمل إعداد مزوّد الخرائط." },

  // ---- Business Engine ----
  "business.title": { en: "Business Engine", ar: "الأعمال" },
  "business.subtitle": { en: "Revenue, expenses, longest-standing clients and reports — the numbers behind the chair.", ar: "الإيرادات والمصروفات وأقدم العميلات والتقارير — الأرقام وراء الكرسي." },
  "business.revenue6mo": { en: "Revenue (6 mo)", ar: "الإيرادات (٦ أشهر)" },
  "business.expenses6mo": { en: "Expenses (6 mo)", ar: "المصروفات (٦ أشهر)" },
  "business.net": { en: "Net", ar: "الصافي" },
  "business.revenueVsExpenses": { en: "Revenue vs expenses", ar: "الإيرادات مقابل المصروفات" },
  "business.emptyChartTitle": { en: "No revenue or expenses yet", ar: "لا توجد إيرادات أو مصروفات بعد" },
  "business.emptyChartDescription": { en: "Once you log completed appointments and expenses, the last 6 months will chart here.", ar: "بمجرد تسجيل المواعيد المكتملة والمصروفات، سيظهر رسم بياني لآخر ٦ أشهر هنا." },
  "business.longestStandingClients": { en: "Longest-standing clients", ar: "أقدم العميلات" },
  "business.emptyClientsTitle": { en: "No clients yet", ar: "لا توجد عميلات بعد" },
  "business.emptyClientsDescription": { en: "Your longest-standing clients will show up here once you've added some.", ar: "ستظهر هنا أقدم عميلاتك بمجرد إضافتهنّ." },
  "business.clientSince": { en: (v) => `client since ${v.date}`, ar: (v) => `عميلة منذ ${v.date}` },
  "business.errorFallback": { en: "Couldn't load your business numbers.", ar: "تعذّر تحميل أرقام عملك." },

  // ---- AI Assistant ----
  "ai.title": { en: "AI Assistant", ar: "المساعد الذكي" },
  "ai.subtitle": { en: "Ask about your workspace — appointments, clients, and services. Grounded in your real data, never invented.", ar: "اسألي عن مساحة عملك — المواعيد والعميلات والخدمات. مبني على بياناتك الحقيقية، وليس مُختلقًا أبدًا." },
  "ai.loading": { en: "Loading…", ar: "جارٍ التحميل…" },
  "ai.gatedTitle": { en: "AI Assistant is a Professional feature", ar: "المساعد الذكي ميزة للخطة الاحترافية" },
  "ai.gatedDescription": { en: "Ask natural-language questions about your own workspace data — appointments, clients, and services — and get grounded answers, never invented ones.", ar: "اطرحي أسئلة بلغة طبيعية عن بيانات مساحة عملك — المواعيد والعميلات والخدمات — واحصلي على إجابات مبنية على الواقع، وليست مُختلقة أبدًا." },
  "ai.viewPlans": { en: "View plans", ar: "عرض الخطط" },
  "ai.whatYoullAsk": { en: "What you'll be able to ask", ar: "ما ستتمكنين من سؤاله" },
  "ai.workspaceAssistant": { en: "Workspace Assistant", ar: "مساعد مساحة العمل" },
  "ai.noWorkspaceSelected": { en: "No workspace selected", ar: "لم يتم اختيار مساحة عمل" },
  "ai.tryAsking": { en: "Try asking:", ar: "جرّبي أن تسألي:" },
  "ai.disclaimer": { en: "I can only answer questions about data already in BeautyRoute — I can't take actions like booking or messaging clients.", ar: "يمكنني فقط الإجابة عن أسئلة تخص البيانات الموجودة بالفعل في BeautyRoute — لا يمكنني تنفيذ إجراءات مثل الحجز أو مراسلة العميلات." },
  "ai.thinking": { en: "Thinking…", ar: "جارٍ التفكير…" },
  "ai.messagePlaceholder": { en: "Ask about your appointments, clients, or services…", ar: "اسألي عن مواعيدك أو عميلاتك أو خدماتك…" },
  "ai.messageLabel": { en: "Message", ar: "رسالة" },
  "ai.send": { en: "Send", ar: "إرسال" },
  "ai.footerDisclaimer": { en: "Responses are AI-generated from your workspace data and may be incomplete or wrong — always review before relying on them or sharing with a client.", ar: "الردود مُنشأة بالذكاء الاصطناعي من بيانات مساحة عملك وقد تكون غير مكتملة أو غير دقيقة — راجعيها دائمًا قبل الاعتماد عليها أو مشاركتها مع عميلة." },
  "ai.genericError": { en: "Something went wrong. Please try again.", ar: "حدث خطأ ما. يرجى المحاولة مرة أخرى." },
  "ai.exampleQuestion.today": { en: "What appointments are scheduled today?", ar: "ما هي المواعيد المجدولة اليوم؟" },
  "ai.exampleQuestion.notReturned": { en: "Which clients have not returned recently?", ar: "ما هنّ العميلات اللواتي لم يعدن مؤخرًا؟" },
  "ai.exampleQuestion.summarize": { en: "Summarize this client's history.", ar: "لخّصي سجل هذه العميلة." },
  "ai.exampleQuestion.inactiveServices": { en: "Which services are currently inactive?", ar: "ما هي الخدمات غير النشطة حاليًا؟" },
  "ai.exampleQuestion.lastVisit": { en: "What happened during the client's latest visit?", ar: "ماذا حدث في آخر زيارة للعميلة؟" },

  // ---- Salon ----
  "salon.title": { en: "Salon Engine", ar: "الصالون" },
  "salon.subtitle": { en: "Unlocks when a mobile stylist opens a physical location — the same passport data, now shared across a team.", ar: "يُفتح عندما تفتح مصففة الشعر المتنقلة موقعًا فعليًا — نفس بيانات الجواز، ولكن مشتركة الآن عبر فريق." },
  "salon.activatesTitle": { en: "This engine activates on the Salon plan", ar: "يُفعَّل هذا المحرك مع خطة الصالون" },
  "salon.activatesDescription": { en: "You're currently on the Mobile Stylist plan. All your Beauty Passports carry over the day you open a location.", ar: "أنتِ حاليًا على خطة المصففة المتنقلة. ستنتقل جميع جوازات الجمال الخاصة بك في اليوم الذي تفتحين فيه موقعًا." },
  "salon.module.staff": { en: "Employees & reception", ar: "الموظفات والاستقبال" },
  "salon.module.staffDesc": { en: "Schedules, roles and permissions per staff member.", ar: "الجداول والأدوار والصلاحيات لكل موظفة." },
  "salon.module.pos": { en: "Point of sale", ar: "نقطة البيع" },
  "salon.module.posDesc": { en: "Ring up services and products at checkout.", ar: "احتسبي الخدمات والمنتجات عند الدفع." },
  "salon.module.inventory": { en: "Inventory", ar: "المخزون" },
  "salon.module.inventoryDesc": { en: "Track product stock and reorder points.", ar: "تتبّعي مخزون المنتجات ونقاط إعادة الطلب." },
  "salon.module.commission": { en: "Commission & loyalty", ar: "العمولات والولاء" },
  "salon.module.commissionDesc": { en: "Automatic staff commission and client loyalty points.", ar: "عمولات تلقائية للموظفات ونقاط ولاء للعميلات." },

  // ---- Pricing ----
  "pricing.backToDashboard": { en: "Back to dashboard", ar: "العودة إلى لوحة التحكم" },
  "pricing.signIn": { en: "Sign in", ar: "تسجيل الدخول" },
  "pricing.heading": { en: "Plans for every stage of your business", ar: "خطط لكل مرحلة من مراحل عملك" },
  "pricing.onTrial": { en: (v) => `You're on a free trial — ${v.days} day${v.days === 1 ? "" : "s"} left.`, ar: (v) => `أنتِ في فترة تجريبية مجانية — تبقّى ${v.days} ${v.days === 1 ? "يوم" : "أيام"}.` },
  "pricing.currentPlan": { en: "Current plan", ar: "الخطة الحالية" },
  "pricing.comingSoon": { en: "Coming Soon", ar: "قريبًا" },
  "pricing.feature.ai": { en: "AI consultation & recommendations", ar: "استشارات وتوصيات الذكاء الاصطناعي" },
  "pricing.feature.routing": { en: "Smart route optimization", ar: "تحسين ذكي للمسارات" },
  "pricing.feature.staff": { en: "Staff & team management", ar: "إدارة الموظفات والفريق" },
  "pricing.feature.analytics": { en: "Business analytics", ar: "تحليلات الأعمال" },
  "pricing.feature.unlimitedClients": { en: "Unlimited clients", ar: "عدد غير محدود من العميلات" },
};

// t(key, lang, vars) -- returns the translated string for `key`, falling
// back to English if the language is missing an entry, and to the raw key
// if the key itself doesn't exist (loud-but-harmless: a missing key shows
// up as literal text in the UI rather than throwing).
export function t(key, lang, vars) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const raw = entry[lang] ?? entry.en ?? key;
  return typeof raw === "function" ? raw(vars ?? {}) : raw;
}

// Translate a stored enum-like value (status/category/tier) for DISPLAY
// only -- the value itself (what's stored in the database and passed back
// on save) is never touched. Falls back to the raw value if there's no
// translation entry for it, so an unexpected/future value never disappears.
export function translateEnum(namespace, value, lang) {
  if (!value) return value;
  const key = `${namespace}.${value}`;
  return STRINGS[key] ? t(key, lang) : value;
}
