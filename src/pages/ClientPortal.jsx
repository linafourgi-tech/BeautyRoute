import { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Camera,
  Upload,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Scissors,
  Palette,
  Wand2,
  CalendarDays,
  Clock,
  BookHeart,
} from "lucide-react";
import { clients } from "../data/mockData";

/* ------------------------------------------------------------------ */
/* Demo data — swap for the real logged-in client + AI Engine later    */
/* ------------------------------------------------------------------ */

const client = clients[0]; // "logged in" client for this demo, e.g. Nour Al-Faisal

const FACE_SHAPES = ["Oval", "Round", "Square", "Heart", "Diamond"];

const STYLE_LIBRARY = {
  Oval: [
    { name: "Curtain-Bang Long Layers", tag: "Best match", desc: "Softens your jawline and adds movement around the face." },
    { name: "Sleek Low Bun", tag: "Elegant", desc: "Shows off your balanced proportions — great for events." },
    { name: "Soft Shag", tag: "Trending", desc: "Effortless texture that works with your natural wave." },
  ],
  Round: [
    { name: "Long Face-Framing Layers", tag: "Best match", desc: "Elongates the face and adds definition at the cheekbones." },
    { name: "Textured Side Pixie", tag: "Bold", desc: "Adds height at the crown to balance width." },
    { name: "High Volume Ponytail", tag: "Everyday", desc: "Lifts the silhouette for a slimming effect." },
  ],
  Square: [
    { name: "Soft Waves", tag: "Best match", desc: "Rounds out strong angles at the jaw for a softer look." },
    { name: "Side-Part Lob", tag: "Classic", desc: "Breaks up symmetry for a more relaxed shape." },
    { name: "Wispy Fringe", tag: "Fresh", desc: "Draws the eye up and softens the forehead line." },
  ],
  Heart: [
    { name: "Chin-Length Bob", tag: "Best match", desc: "Balances a narrower jaw against a fuller forehead." },
    { name: "Deep Side Part", tag: "Flattering", desc: "Shifts visual weight away from a wider hairline." },
    { name: "Side-Swept Bangs", tag: "Soft", desc: "Minimizes forehead width, keeps focus on the eyes." },
  ],
  Diamond: [
    { name: "Chin-Length Layers", tag: "Best match", desc: "Widens the jawline for a more balanced outline." },
    { name: "Textured Pixie", tag: "Statement", desc: "Plays up your cheekbones beautifully." },
    { name: "Side-Swept Fringe", tag: "Soft", desc: "Softens a narrower forehead and chin." },
  ],
};

const SERVICES = [
  { id: "cut", name: "Haircut", icon: Scissors, price: "SAR 120", duration: "45 min" },
  { id: "color", name: "Color Formula", icon: Palette, price: "SAR 280", duration: "2 hr" },
  { id: "style", name: "Styling", icon: Wand2, price: "SAR 90", duration: "30 min" },
];

const ANALYZE_STEPS = [
  "Scanning facial contours…",
  "Reading your Beauty Passport history…",
  "Matching hairstyles to your face shape…",
  "Finalizing your recommendations…",
];

function nextSevenDays() {
  const base = new Date("2026-07-19T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

const TIME_SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "18:30"];

/* ------------------------------------------------------------------ */

export default function ClientPortal() {
  const [passportOpen, setPassportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink text-ivory">
      <div className="max-w-md mx-auto min-h-screen bg-ink shadow-[0_0_60px_rgba(156,85,104,0.10)] relative">
        <Header client={client} onOpenPassport={() => setPassportOpen(true)} />

        <main className="px-5 pb-16 space-y-10 pt-6">
          <AIConsultationHub client={client} />
          <SmartBookingEngine client={client} />
        </main>

        {passportOpen && (
          <PassportSheet client={client} onClose={() => setPassportOpen(false)} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Header ----------------------------- */

function Header({ client, onOpenPassport }) {
  const firstName = client.name.split(" ")[0];
  return (
    <header className="sticky top-0 z-20 bg-ink/90 backdrop-blur-md border-b border-line px-5 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-wine font-medium">Welcome back</p>
          <h1 className="font-display text-2xl text-ivory mt-0.5">{firstName} ✨</h1>
        </div>
        <img
          src={client.photo}
          alt=""
          className="h-11 w-11 rounded-full object-cover ring-2 ring-line"
        />
      </div>

      <button
        onClick={onOpenPassport}
        className="mt-4 w-full flex items-center justify-between rounded-2xl border border-line bg-gradient-to-r from-surface-2 to-surface px-4 py-3 group"
      >
        <span className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
            <BookHeart size={15} className="text-wine" />
          </span>
          <span className="text-sm font-medium text-ivory">View my Beauty Passport</span>
        </span>
        <ChevronRight size={16} className="text-wine group-hover:translate-x-0.5 transition-transform" />
      </button>
    </header>
  );
}

/* ------------------------- AI Consultation Hub ---------------------- */

function AIConsultationHub({ client }) {
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | ready | analyzing | done
  const [stepIndex, setStepIndex] = useState(0);
  const [faceShape, setFaceShape] = useState(null);
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhoto(url);
    setStatus("ready");
    setFaceShape(null);
  }

  function clearPhoto() {
    setPhoto(null);
    setStatus("idle");
    setFaceShape(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function runAnalysis() {
    setStatus("analyzing");
    setStepIndex(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      if (i < ANALYZE_STEPS.length) {
        setStepIndex(i);
      } else {
        clearInterval(interval);
        const shape = FACE_SHAPES[Math.floor(Math.random() * FACE_SHAPES.length)];
        setFaceShape(shape);
        setStatus("done");
      }
    }, 650);
  }

  const recommendations = faceShape ? STYLE_LIBRARY[faceShape] : [];
  const lastNote = client.timeline?.[0]?.notes;

  return (
    <section>
      <SectionHeading
        icon={Sparkles}
        title="AI Hair Consultation"
        subtitle="Upload a photo, get a face-shape reading matched to your own history."
      />

      <div className="rounded-3xl border border-line bg-white p-5">
        {/* Upload area */}
        {status === "idle" && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-line bg-surface-2 flex flex-col items-center justify-center gap-3 hover:border-wine transition-colors"
          >
            <span className="h-14 w-14 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Camera size={22} className="text-wine" />
            </span>
            <span className="text-sm font-medium text-ivory">Snap a selfie or upload a photo</span>
            <span className="text-xs text-muted flex items-center gap-1">
              <Upload size={12} /> JPG or PNG, good lighting works best
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFile}
          className="hidden"
        />

        {/* Photo preview + analyze */}
        {(status === "ready" || status === "analyzing" || status === "done") && (
          <div className="relative rounded-2xl overflow-hidden">
            <img src={photo} alt="Your upload" className="w-full aspect-[4/3] object-cover" />
            {status === "ready" && (
              <button
                onClick={clearPhoto}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
              >
                <X size={14} />
              </button>
            )}

            {status === "analyzing" && (
              <div className="absolute inset-0 bg-ivory/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-6">
                <span className="h-10 w-10 rounded-full border-2 border-line border-t-transparent animate-spin" />
                <p className="text-white text-sm font-medium">{ANALYZE_STEPS[stepIndex]}</p>
              </div>
            )}

            {status === "done" && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <span className="rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-ivory shadow-sm">
                  Face shape: <span className="text-wine font-semibold">{faceShape}</span>
                </span>
                <button
                  onClick={clearPhoto}
                  className="h-8 w-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {status === "ready" && (
          <button
            onClick={runAnalysis}
            className="mt-4 w-full rounded-full bg-wine text-white text-sm font-medium py-3 flex items-center justify-center gap-2 hover:bg-wine-light transition-colors"
          >
            <Sparkles size={15} /> Analyze my face shape
          </button>
        )}

        {/* Results */}
        {status === "done" && (
          <div className="mt-5 space-y-5 animate-fade-in-up">
            <div className="rounded-2xl bg-gradient-to-br from-surface-2 to-surface border border-line p-4">
              <p className="text-[11px] uppercase tracking-wide text-wine font-semibold mb-1.5">
                AI advice, made for you
              </p>
              <p className="text-sm text-ivory leading-relaxed">
                Your <span className="font-semibold">{faceShape?.toLowerCase()}</span> face shape pairs
                beautifully with soft layers that add movement.
                {lastNote && (
                  <> Based on your last visit note — "{lastNote.length > 60 ? lastNote.slice(0, 60) + "…" : lastNote}"
                  — we've also factored in how your hair naturally holds a style.</>
                )}
                {" "}Here are your top matches:
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-ivory mb-3">Top 3 recommended for you</p>
              <StyleCardCarousel styles={recommendations} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StyleCardCarousel({ styles }) {
  const [index, setIndex] = useState(0);
  const gradients = [
    "from-gold-soft to-surface-2",
    "from-wine-light to-gold-soft",
    "from-surface-2 to-gold-soft",
  ];

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {styles.map((s, i) => (
            <div key={s.name} className="w-full shrink-0 px-0.5">
              <div className="rounded-2xl border border-line bg-white overflow-hidden">
                <div className={`h-32 bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                  <Scissors size={28} className="text-white/90" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-ivory">{s.name}</p>
                    <span className="text-[10px] uppercase tracking-wide text-wine bg-surface-2 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {s.tag}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="h-8 w-8 rounded-full border border-line flex items-center justify-center text-wine disabled:opacity-30"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="flex gap-1.5">
          {styles.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-wine" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setIndex((i) => Math.min(styles.length - 1, i + 1))}
          disabled={index === styles.length - 1}
          className="h-8 w-8 rounded-full border border-line flex items-center justify-center text-wine disabled:opacity-30"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------- Smart Booking Engine ---------------------- */

function SmartBookingEngine() {
  const days = useMemo(() => nextSevenDays(), []);
  const [service, setService] = useState(null);
  const [day, setDay] = useState(null);
  const [time, setTime] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const canConfirm = service && day && time;

  function confirm() {
    if (!canConfirm) return;
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 text-center">
        <span className="h-12 w-12 mx-auto rounded-full bg-surface-2 flex items-center justify-center mb-3">
          <Check size={20} className="text-wine" />
        </span>
        <p className="font-display text-xl text-ivory">Reservation confirmed</p>
        <p className="text-sm text-muted mt-1">
          {service.name} · {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at {time}
        </p>
        <button
          onClick={() => { setConfirmed(false); setService(null); setDay(null); setTime(null); }}
          className="mt-5 text-sm text-wine font-medium"
        >
          Book another visit
        </button>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading
        icon={CalendarDays}
        title="Book your next visit"
        subtitle="Choose a service, then a day and time that works for you."
      />

      <div className="rounded-3xl border border-line bg-white p-5 space-y-6">
        {/* Service selector */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2.5">Service</p>
          <div className="grid grid-cols-3 gap-2.5">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => setService(s)}
                className={`rounded-2xl border px-2 py-3.5 flex flex-col items-center gap-1.5 transition-colors ${
                  service?.id === s.id
                    ? "border-wine bg-surface-2"
                    : "border-line hover:border-gold-soft"
                }`}
              >
                <s.icon size={18} className={service?.id === s.id ? "text-wine" : "text-muted"} />
                <span className="text-xs font-medium text-ivory">{s.name}</span>
                <span className="text-[10px] text-muted">{s.price}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date picker */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2.5">Day</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const active = day?.toDateString() === d.toDateString();
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDay(d)}
                  className={`shrink-0 w-14 rounded-2xl border py-2.5 flex flex-col items-center gap-0.5 transition-colors ${
                    active ? "border-wine bg-wine text-white" : "border-line text-ivory"
                  }`}
                >
                  <span className={`text-[10px] uppercase ${active ? "text-white/80" : "text-muted"}`}>
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <span className="text-sm font-semibold">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time picker */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2.5 flex items-center gap-1.5">
            <Clock size={12} /> Time
          </p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_SLOTS.map((t) => (
              <button
                key={t}
                onClick={() => setTime(t)}
                className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                  time === t ? "border-wine bg-wine text-white" : "border-line text-ivory"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={!canConfirm}
          className="w-full rounded-full py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-wine to-wine-light disabled:opacity-40 disabled:grayscale transition-opacity"
        >
          Confirm reservation
        </button>
      </div>
    </section>
  );
}

/* ------------------------------ Shared UI ---------------------------- */

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={16} className="text-wine" />
      </span>
      <div>
        <h2 className="font-display text-lg text-ivory">{title}</h2>
        <p className="text-xs text-muted mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function PassportSheet({ client, onClose }) {
  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85%] overflow-y-auto rounded-t-3xl bg-white p-6">
        <div className="h-1 w-10 bg-line rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-5">
          <img src={client.photo} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-line" />
          <div>
            <p className="font-display text-xl text-ivory">{client.name}</p>
            <p className="text-xs text-muted">Client since {new Date(client.since).toLocaleDateString("en-GB", { year: "numeric", month: "short" })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <PassportField label="Hair formula" value={client.hairFormula} />
          <PassportField label="Allergies" value={client.allergies.length ? client.allergies.join(", ") : "None on file"} />
        </div>

        <p className="text-sm font-medium text-ivory mb-3">Your visit history</p>
        <div className="space-y-4 border-l border-line pl-4">
          {client.timeline.map((t, i) => (
            <div key={i} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-wine" />
              <p className="text-[11px] text-wine font-medium">{t.date}</p>
              <p className="text-sm text-ivory">{t.service}</p>
              <p className="text-xs text-muted mt-0.5">{t.notes}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-full border border-line text-ivory text-sm font-medium py-3"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PassportField({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm text-ivory mt-1">{value}</p>
    </div>
  );
}
