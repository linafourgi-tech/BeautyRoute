// Client app views — fully localized. UI chrome swaps with `lang`; user-generated
// content (professional names, reviews, uploaded portfolios) stays in its own language.
const T = (k, lang) => window.BRI18N.t(k, lang);
const P = (k, lang, n) => window.BRI18N.p(k, lang, n);

// Catalog inspiration styles are platform content → provided in both languages.
const FEED = {
  women: {
    tags: ["All","Balayage","Curly","Bob","Updo","Bridal"],
    items: [
      { en:"Sun-kissed waves", ar:"خصلات مشمسة" },
      { en:"Soft curtain bangs", ar:"غرة ستائرية ناعمة" },
      { en:"Glass hair", ar:"شعر زجاجي" },
      { en:"Bridal updo", ar:"تسريحة عروس مرفوعة" },
      { en:"Copper glow", ar:"توهّج نحاسي" },
      { en:"Textured lob", ar:"لوب نصّي" },
      { en:"Face-framing curls", ar:"خصل تحيط بالوجه" },
      { en:"Golden balayage", ar:"بالياج ذهبي" },
    ],
  },
  men: {
    tags: ["All","Fade","Beard","Textured crop","Scalp care","Color"],
    items: [
      { en:"Skin fade", ar:"تدريج ناعم" },
      { en:"Textured crop", ar:"قصّة نصّية" },
      { en:"Beard sculpt", ar:"نحت اللحية" },
      { en:"Classic side part", ar:"فرق جانبي كلاسيكي" },
      { en:"Salt & pepper blend", ar:"مزيج ملحي فلفلي" },
      { en:"Buzz + line-up", ar:"حلاقة قصيرة مع تحديد" },
      { en:"Scalp facial", ar:"عناية بفروة الرأس" },
      { en:"Grey coverage", ar:"تغطية الشيب" },
    ],
  },
};
function InspirationView({ exp = "women", onExp, lang = "en" }) {
  const { GalleryCard, Tag, Search, ExperienceSwitcher } = window.BeautyRouteDesignSystem_b9f150;
  const [active,setActive] = React.useState("All");
  const feed = FEED[exp];
  React.useEffect(()=>setActive("All"),[exp]);
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 20 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" } },
      React.createElement(Search, { placeholder: T("search.placeholder", lang) }),
      React.createElement(ExperienceSwitcher, { value: exp, onChange: onExp, lang: lang })),
    React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, feed.tags.map((t,i)=>React.createElement(Tag,{key:i,selected:active===t,onClick:()=>setActive(t)}, T("tag."+t, lang)))),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 } },
      feed.items.map((it,i)=>React.createElement(GalleryCard,{key:i,title:window.BRI18N.pickLocalized(it,lang),tag:T("tag."+feed.tags[(i%5)+1], lang)}))
    )
  );
}
function FavoritesView({ lang = "en" }) {
  const { PortfolioCard, FavoriteButton, Tag, Button } = window.BeautyRouteDesignSystem_b9f150;
  const cats=["All","Hair","Makeup","Nails","Barber"];
  const [cat,setCat]=React.useState("All");
  // Professional names are UGC (proper nouns) — not translated.
  const pros=[["Lujain — Riyadh","Hair"],["Salon Aura — Jeddah","Hair"],["Noor Studio — Riyadh","Makeup"]];
  return React.createElement("div",{style:{display:'flex',flexDirection:'column',gap:18}},
    React.createElement("div",{style:{display:'flex',gap:8,flexWrap:'wrap'}},cats.map((c,i)=>React.createElement(Tag,{key:i,selected:cat===c,onClick:()=>setCat(c)}, T("tag."+c, lang)))),
    React.createElement("div",{style:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}},
      pros.filter(p=>cat==="All"||p[1]===cat).map((p,i)=>React.createElement("div",{key:i,style:{position:'relative',display:'flex',flexDirection:'column',gap:10}},
        React.createElement("div",{style:{position:'absolute',top:10,insetInlineEnd:10,zIndex:1}},React.createElement(FavoriteButton,{saved:true})),
        React.createElement(PortfolioCard,{title:p[0],meta:T("fav.available", lang)}),
        React.createElement(Button,{variant:"gold",size:"sm"}, T("cta.bookAgain", lang)))))
  );
}
function MatchView({ lang = "en" }) {
  const { PortfolioCard, Button, Badge } = window.BeautyRouteDesignSystem_b9f150;
  const matchedStyle = window.BRI18N.pickLocalized({ en:"Sun-kissed waves", ar:"خصلات مشمسة" }, lang);
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 24 } },
    React.createElement("div", null,
      React.createElement(Badge,{tone:"gold"}, T("match.matchedTo", lang)+": "+matchedStyle),
      React.createElement("h2", { style: { fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--text-primary)", margin: "10px 0 4px" } }, T("match.title", lang)),
      React.createElement("p", { style: { fontSize: 14, color: "var(--text-tertiary)", margin: 0 } }, T("match.subtitle", lang))
    ),
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 } },
      ["Lujain — Riyadh","Salon Aura — Jeddah","Noor Studio — Riyadh"].map((n,i)=>React.createElement("div",{key:i,style:{display:'flex',flexDirection:'column',gap:10}},
        React.createElement(PortfolioCard,{title:n,meta:P("pieces", lang, 12)}),
        React.createElement(Button,{variant:"secondary",size:"sm"}, T("cta.viewProfile", lang))
      ))
    )
  );
}
function BookingsView({ lang = "en" }) {
  const { BookingCard, Tabs, TravelCard, RebookCard } = window.BeautyRouteDesignSystem_b9f150;
  const tabs=[{k:"Upcoming",l:T("bookings.upcoming",lang)},{k:"Past",l:T("bookings.past",lang)}];
  const [t,setT]=React.useState("Upcoming");
  const tabLabels=tabs.map(x=>x.l);
  const kByLabel=l=>tabs.find(x=>x.l===l).k;
  const activeLabel=tabs.find(x=>x.k===t).l;
  if(t==="Past") return React.createElement("div",{style:{display:'flex',flexDirection:'column',gap:14}},
    React.createElement(Tabs,{tabs:tabLabels,active:activeLabel,onChange:l=>setT(kByLabel(l))}),
    React.createElement(RebookCard,{professional:"Lujain",service:window.BRI18N.pickLocalized({en:"Balayage touch-up",ar:"تجديد بالياج"},lang),lastVisit:lang==="ar"?"قبل ٦ أسابيع":"6 weeks ago",duration:P("minutes",lang,45),price:window.BRI18N.formatSAR(250,lang),suggestedDate:lang==="ar"?"هذا الأسبوع":"this week",lang:lang}),
    React.createElement(RebookCard,{professional:"Noor Studio",service:window.BRI18N.pickLocalized({en:"Cut & style",ar:"قص وتصفيف"},lang),lastVisit:lang==="ar"?"قبل ٣ أشهر":"3 months ago",duration:P("minutes",lang,30),price:window.BRI18N.formatSAR(160,lang),tone:"blush",lang:lang}));
  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
    React.createElement(Tabs,{tabs:tabLabels,active:activeLabel,onChange:l=>setT(kByLabel(l))}),
    React.createElement(BookingCard,{client:"Lujain",service:window.BRI18N.pickLocalized({en:"Balayage",ar:"بالياج"},lang),time:lang==="ar"?"اليوم، ٤:٠٠ م":"Today, 4:00 PM",status:"confirmed",statusLabel:T("bookings.confirmed",lang),lang:lang}),
    React.createElement(BookingCard,{client:"Salon Aura",service:window.BRI18N.pickLocalized({en:"Blowout",ar:"سيشوار"},lang),time:lang==="ar"?"٢٨ يوليو، ١١:٠٠ ص":"Jul 28, 11:00 AM",status:"pending",statusLabel:T("bookings.pending",lang),lang:lang}),
    React.createElement(TravelCard,{destination:"Salon Aura · King Fahd Rd",distanceKm:6,minutes:14,onNavigate:()=>{},lang:lang})
  );
}
function AIConsultView({ lang = "en" }) {
  const { AIRecommendationCard, Button } = window.BeautyRouteDesignSystem_b9f150;
  const [started,setStarted]=React.useState(false);
  if(!started) return React.createElement("div",{style:{textAlign:'center',padding:'60px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:16}},
    React.createElement("h2",{style:{fontFamily:'var(--font-display)',fontSize:'var(--text-h2)',color:'var(--text-primary)',margin:0}}, T("ai.emptyTitle", lang)),
    React.createElement("p",{style:{fontSize:14,color:'var(--text-tertiary)',maxWidth:360,margin:0}}, T("ai.emptyBody", lang)),
    React.createElement(Button,{variant:"gold",onClick:()=>setStarted(true)}, T("cta.startAI", lang))
  );
  return React.createElement("div",{style:{display:'flex',flexDirection:'column',gap:16}},
    React.createElement("h2",{style:{fontFamily:'var(--font-display)',fontSize:'var(--text-h3)',color:'var(--text-primary)',margin:0}}, T("ai.resultsTitle", lang)),
    React.createElement(AIRecommendationCard,{style:window.BRI18N.pickLocalized({en:"Soft curtain bangs",ar:"غرة ستائرية ناعمة"},lang),reason:lang==="ar"?"يناسب شكل وجهك المستدير وشعرك الناعم.":"Complements your round face shape and fine hair texture."}),
    React.createElement(AIRecommendationCard,{style:window.BRI18N.pickLocalized({en:"Face-framing layers",ar:"طبقات تحيط بالوجه"},lang),reason:lang==="ar"?"يضيف حركة مع الحفاظ على الطول لتصفيف متنوّع.":"Adds movement while keeping length for versatile styling."})
  );
}
window.InspirationView = InspirationView;
window.FavoritesView = FavoritesView;
window.MatchView = MatchView;
window.BookingsView = BookingsView;
window.AIConsultView = AIConsultView;
