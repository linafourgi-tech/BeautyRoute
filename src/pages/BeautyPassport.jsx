import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Droplet, Heart, Phone, Sparkles, Star } from "lucide-react";
import { clients } from "../data/mockData";
import Layout from "../components/Layout";

export default function BeautyPassport() {
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get("client");
  const [selectedId, setSelectedId] = useState(
    clients.find((c) => c.id === preselected)?.id ?? clients[0].id
  );
  const client = clients.find((c) => c.id === selectedId);

  return (
    <Layout
      title="Beauty Passport"
      titleAr="جواز الجمال"
      subtitle="Every client's story, remembered — a chronological record of formulas, looks, and notes."
    >
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* Client list */}
        <div className="space-y-2.5">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                selectedId === c.id
                  ? "border-wine bg-surface"
                  : "border-line bg-surface/60 hover:border-muted"
              }`}
            >
              <img src={c.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-ivory text-sm font-medium truncate">{c.name}</p>
                <p className="text-muted text-xs truncate mt-0.5">Last visit {c.lastVisit}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Storybook */}
        {client && (
          <div className="space-y-8">
            {/* Cover */}
            <div className="rounded-3xl border border-line bg-surface p-8 md:p-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                <img
                  src={client.photo}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-surface-2"
                />
                <div className="flex-1">
                  <p className="font-mono-tag text-[11px] uppercase tracking-[0.16em] text-gold">Beauty Passport</p>
                  <h2 className="font-display text-3xl text-ivory mt-1">{client.name}</h2>
                  <p className="text-muted text-sm mt-1">
                    Client since {new Date(client.since).toLocaleDateString("en-GB", { year: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {client.tags.map((t) => (
                    <span key={t} className="text-[11px] uppercase tracking-wide bg-surface-2 text-wine px-3 py-1.5 rounded-full font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                <InfoCard icon={Droplet} label="Hair formula" value={client.hairFormula} />
                <InfoCard
                  icon={AlertTriangle}
                  label="Allergies"
                  value={client.allergies.length ? client.allergies.join(", ") : "None on file"}
                  warn={client.allergies.length > 0}
                />
                <InfoCard icon={Heart} label="Favorite stylist" value={client.favoriteStylist} />
                <InfoCard icon={Phone} label="Phone" value={client.phone} />
              </div>
            </div>

            {/* AI Insight badge */}
            <div className="rounded-3xl border border-gold/40 bg-surface-2 px-7 py-6 flex items-start gap-4">
              <span className="h-10 w-10 rounded-full bg-surface flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={17} className="text-gold" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gold font-semibold mb-1">AI Insight</p>
                <p className="text-ivory text-[15px] leading-relaxed">
                  Based on this timeline, suggest a gloss refresh at the next visit and confirm the
                  ammonia-free formula before any color service.
                </p>
              </div>
            </div>

            {/* Storybook timeline with polaroid frames */}
            <div>
              <h3 className="font-display text-2xl text-ivory mb-6">Her story so far</h3>
              <div className="space-y-10">
                {client.timeline.map((t, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-5 items-start">
                    {/* Polaroid */}
                    <div className="bg-surface border border-line rounded-sm p-2.5 pb-6 shadow-[0_6px_16px_rgba(43,36,32,0.08)] sm:-rotate-2 w-40 sm:w-full mx-auto sm:mx-0">
                      <img
                        src={t.photo}
                        alt={t.service}
                        className="w-full aspect-[4/5] object-cover rounded-[2px]"
                      />
                      <p className="font-display text-[13px] text-center text-muted mt-2">{t.date}</p>
                    </div>

                    {/* Story text */}
                    <div className="pt-1 sm:pt-3">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-display text-xl text-ivory">{t.service}</p>
                        <span className="inline-flex items-center gap-0.5 text-gold text-xs">
                          {Array.from({ length: t.rating }).map((_, s) => (
                            <Star key={s} size={11} fill="currentColor" strokeWidth={0} />
                          ))}
                        </span>
                      </div>
                      <p className="text-ivory/80 text-[15px] leading-relaxed">{t.notes}</p>
                      <span className="inline-block mt-3 text-[11px] font-mono-tag uppercase tracking-wide text-wine bg-surface-2 px-3 py-1.5 rounded-full">
                        Formula on file: {client.hairFormula}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function InfoCard({ icon: Icon, label, value, warn }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${warn ? "border-danger/40 bg-danger/5" : "border-line bg-surface-2"}`}>
      <p className={`text-[11px] uppercase tracking-wide flex items-center gap-1.5 ${warn ? "text-danger" : "text-muted"}`}>
        <Icon size={13} /> {label}
      </p>
      <p className="text-ivory text-[15px] mt-1.5">{value}</p>
    </div>
  );
}
