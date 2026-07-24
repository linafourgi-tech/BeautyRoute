const N = window.BeautyRouteDesignSystem_b9f150;
const I = window.BRI18N;
function BookingApp(){
  const { EditorialImage, Input, BookingLocations, LanguageSwitcher } = N;
  // Per-user language preference — restored from profile, persisted on change.
  const [lang,setLang]=React.useState(()=>{try{return localStorage.getItem("br.user.lang")||"en";}catch(e){return "en";}});
  React.useEffect(()=>{I.applyDir(lang);try{localStorage.setItem("br.user.lang",lang);}catch(e){}},[lang]);
  const T=k=>I.t(k,lang), P=(k,n)=>I.p(k,lang,n), num=n=>n.toLocaleString(lang==="ar"?"ar-SA":"en-GB");

  // Provider profile (DB). Service names + location labels are authored per-language.
  const provider = { name:"Lujain", roleAr:"خبيرة صبغات حرة · الرياض", roleEn:"Freelance colorist · Riyadh", locations:[
    { id:"studio", type:"studio", label:{en:"My studio",ar:"استوديو الخاص"}, detail:{en:"Al Malqa, Riyadh",ar:"الملقا، الرياض"}, fee:0 },
    { id:"client", type:"client", label:{en:"Your location",ar:"موقعك"}, fee:30 },
  ]};
  const svcName = { en:"Balayage touch-up", ar:"تجديد بالياج" };
  const svcTag = { en:"Balayage", ar:"بالياج" };
  const [loc,setLoc]=React.useState(provider.locations[0]?.id);
  const when = new Date(2026,6,24,16,0);
  const chosenRaw = provider.locations.find(l=>l.id===loc) || {};
  const chosenLabel = I.pickLocalized(chosenRaw.label, lang);
  const svcPrice = 250;
  const total = svcPrice + (chosenRaw.fee||0);
  // Localize location labels for the picker.
  const locs = provider.locations.map(l=>({...l, label:I.pickLocalized(l.label,lang), detail:I.pickLocalized(l.detail,lang)}));
  const label={fontSize:11,fontWeight:600,letterSpacing:lang==="ar"?"0":"0.08em",textTransform:lang==="ar"?"none":"uppercase",color:"var(--text-tertiary)"};
  return <div style={{minHeight:"100vh",background:"var(--bg-page)",display:"flex",justifyContent:"center",padding:"64px 24px"}}>
    <div style={{width:"100%",maxWidth:560,fontFamily:"var(--font-body)"}}>

      <div style={{display:"flex",justifyContent:lang==="ar"?"flex-start":"flex-end",marginBottom:12}}>
        <LanguageSwitcher lang={lang} onChange={setLang} variant="compact" />
      </div>

      {/* eyebrow */}
      <div style={{...label,color:"var(--accent-gold-strong)",marginBottom:28,textAlign:"center"}}>{T("book.eyebrow")}</div>

      {/* HERO — selected service */}
      <div style={{borderRadius:"var(--radius-xl)",overflow:"hidden",background:"var(--surface-card)",boxShadow:"var(--shadow-lg)"}}>
        <div style={{position:"relative"}}>
          <EditorialImage tone="rose" label="" ratio="16 / 7" radius="0" overlay={
            <div>
              <div style={{...label,color:"rgba(250,247,242,0.75)"}}>{I.pickLocalized(svcTag,lang)}</div>
              <div style={{fontFamily:"var(--font-display)",fontSize:34,lineHeight:1.15,color:"var(--ivory-100)",marginTop:4}}>{I.pickLocalized(svcName,lang)}</div>
            </div>
          } />
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16,padding:"20px 28px"}}>
          <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
            <EditorialImage tone="sand" label="" ratio="1 / 1" radius="var(--radius-pill)" />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:600,color:"var(--text-primary)"}}>{provider.name}</div>
            <div style={{fontSize:13,color:"var(--text-tertiary)"}}>{lang==="ar"?provider.roleAr:provider.roleEn}</div>
          </div>
          <div style={{textAlign:"end"}}>
            <div style={{color:"var(--accent-gold-strong)",fontSize:13,letterSpacing:1}}>★ {num(4.9)}</div>
            <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>{P("reviews",214)}</div>
          </div>
          <div style={{width:1,alignSelf:"stretch",background:"var(--border-subtle)"}}></div>
          <div style={{textAlign:"end"}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:20,color:"var(--text-primary)"}}>{I.formatSAR(svcPrice,lang)}</div>
            <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>{P("minutes",45)}</div>
          </div>
        </div>
      </div>

      {/* WHEN */}
      <div style={{marginTop:44}}>
        <div style={{...label,marginBottom:14}}>{T("book.when")}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Input label={T("book.date")} value={I.formatDate(when,lang)} readOnly />
          <Input label={T("book.time")} value={I.formatTime(when,lang)} readOnly />
        </div>
      </div>

      {/* WHERE — provider-driven locations */}
      <div style={{marginTop:36}}>
        <div style={{...label,marginBottom:14}}>{T("book.where")}</div>
        <BookingLocations value={loc} onChange={setLoc} locations={locs} lang={lang} />
      </div>

      {/* ACCOUNT */}
      <div style={{marginTop:36,display:"flex",alignItems:"center",gap:10,paddingTop:20,borderTop:"1px solid var(--border-subtle)"}}>
        <span style={{fontSize:13,color:"var(--text-tertiary)"}}>{T("book.bookingAs")}</span>
        <span style={{fontSize:13,fontWeight:500,color:"var(--text-secondary)"}}>Lina Al-Harbi · +966 5X XXX XXXX</span>
        <a href="#" style={{marginInlineStart:"auto",fontSize:13,fontWeight:600}}>{T("cta.change")}</a>
      </div>

      {/* SUMMARY + CTA */}
      <div style={{marginTop:40}}>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {[
            [I.pickLocalized(svcName,lang), I.formatSAR(svcPrice,lang)],
            [chosenLabel + (chosenRaw.fee?" · "+T("book.travel"):""), I.formatSAR(chosenRaw.fee||0,lang)],
          ].map((r,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:14,color:"var(--text-secondary)"}}>
              <span>{r[0]}</span><span style={{fontVariantNumeric:"tabular-nums"}}>{r[1]}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:12,borderTop:"1px solid var(--border-subtle)"}}>
            <span style={{fontSize:14,color:"var(--text-tertiary)"}}>{T("book.total")} · {I.formatDate(when,lang)}</span>
            <span style={{fontFamily:"var(--font-display)",fontSize:26,color:"var(--text-primary)"}}>{I.formatSAR(total,lang)}</span>
          </div>
        </div>
        <button style={{width:"100%",background:"var(--accent-gold)",color:"var(--charcoal-900)",border:"none",borderRadius:"var(--radius-pill)",padding:"18px",fontSize:16,fontWeight:600,fontFamily:"var(--font-body)",cursor:"pointer",boxShadow:"var(--shadow-gold)",transition:"transform var(--dur-fast) var(--ease-standard)"}}
          onMouseDown={e=>e.currentTarget.style.transform="scale(0.985)"} onMouseUp={e=>e.currentTarget.style.transform="none"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>
          {T("cta.book")}
        </button>
        <div style={{textAlign:"center",fontSize:12,color:"var(--text-tertiary)",marginTop:12}}>{T("book.freeCancel")}</div>
      </div>
    </div>
  </div>;
}
window.BookingApp = BookingApp;
