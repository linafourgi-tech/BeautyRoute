const N = window.BeautyRouteDesignSystem_b9f150;
function Chip({children}){return <span style={{fontSize:12,padding:'4px 12px',borderRadius:'var(--radius-pill)',background:'var(--bg-sunken)',color:'var(--text-secondary)'}}>{children}</span>;}
function Section({title,children,aside}){
  return <section style={{marginBottom:36}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:14}}>
      <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-h3)',color:'var(--text-primary)',margin:0}}>{title}</h2>
      {aside}
    </div>
    {children}
  </section>;
}
function PassportHeader(){
  const { EditorialImage, Badge, FavoriteButton } = N;
  return <div style={{display:'flex',gap:24,alignItems:'center',padding:'28px',borderRadius:'var(--radius-xl)',background:'var(--surface-card)',boxShadow:'var(--shadow-md)'}}>
    <div style={{width:96,flexShrink:0}}><EditorialImage tone="rose" label="" ratio="1 / 1" radius="var(--radius-pill)" /></div>
    <div style={{flex:1}}>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <h1 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-h1)',color:'var(--text-primary)',margin:0}}>Sara Al-Otaibi</h1>
        <Badge tone="gold">VIP</Badge>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
        <Chip>+966 5X XXX XXXX</Chip><Chip>sara@email.com</Chip><Chip>WhatsApp reminders</Chip><Chip>Birthday · 14 Mar</Chip>
      </div>
    </div>
    <FavoriteButton saved variant="pill" label="Regular" />
  </div>;
}
function HealthNotes(){
  const { Badge } = N;
  const items=[["Allergies","PPD (dark dyes)","error"],["Sensitive products","Strong ammonia","warning"],["Scalp","Dry, flake-prone","neutral"],["Medical","None on file","neutral"]];
  return <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
    {items.map(([k,v,tone],i)=>(
      <div key={i} style={{padding:'14px 16px',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-subtle)',background:'var(--surface-card)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontSize:12,color:'var(--text-tertiary)'}}>{k}</div><div style={{fontSize:14,color:'var(--text-primary)',marginTop:2}}>{v}</div></div>
        <Badge tone={tone}>{tone==='error'?'Warning':tone==='warning'?'Caution':'Noted'}</Badge>
      </div>
    ))}
  </div>;
}
function Preferences(){
  const prefs=["Prefers cool blonde","No strong fragrance","Wants natural finish","Drinks coffee","WhatsApp reminders"];
  return <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{prefs.map((p,i)=><Chip key={i}>{p}</Chip>)}</div>;
}
function PassportApp(){
  const { Tabs, Timeline, FormulaCard, ClientNotes, BeforeAfterGallery, AIInsightCard, ReviewSummary, Table, Badge, Button, RebookCard } = N;
  const tabs=["Overview","Beauty History","Hair History","Gallery","Appointments","Payments","Documents"];
  const [tab,setTab]=React.useState("Overview");
  return <div style={{maxWidth:1000,margin:'0 auto',padding:'32px var(--gutter-desktop) 80px'}}>
    <div style={{fontSize:11,fontWeight:600,letterSpacing:'var(--ls-overline)',textTransform:'uppercase',color:'var(--accent-gold-strong)',marginBottom:8}}>Beauty Passport</div>
    <PassportHeader/>
    <div style={{margin:'24px 0 28px'}}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
    {tab==="Overview" && <div>
      <Section title="AI insights"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <AIInsightCard kind="time" insight="Recommended touch-up in 6 weeks" detail="Based on Sara's balayage grow-out rate." action={<Button variant="gold" size="sm">Suggest a date</Button>} />
        <AIInsightCard kind="health" insight="Hair condition improving" detail="Less breakage reported over the last 3 visits." />
      </div></Section>
      <Section title="Allergies & medical notes"><HealthNotes/></Section>
      <Section title="Personal preferences"><Preferences/></Section>
    </div>}
    {tab==="Beauty History" && <Section title="Every visit">
      <Timeline items={[
        {date:"12 Jun 2026",title:"Balayage",subtitle:"Lujain · 2h · SAR 480",meta:"Notes: cool tone, natural finish"},
        {date:"1 May 2026",title:"Root touch-up + gloss",subtitle:"Lujain · 1h 15m · SAR 260"},
        {date:"20 Mar 2026",title:"Cut & style",subtitle:"Noor · 45m · SAR 160"},
      ]}/>
    </Section>}
    {tab==="Hair History" && <div>
      <Section title="Formulas used"><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <FormulaCard title="Balayage · roots" date="12 Jun 2026" professional="Lujain" rows={[{label:"Base",value:"9.1"},{label:"Lightener",value:"BlondMe 9%"},{label:"Toner",value:"T-Silver"},{label:"Timing",value:"35 min"}]} />
        <FormulaCard title="Gloss refresh" date="1 May 2026" professional="Lujain" rows={[{label:"Base",value:"10.21"},{label:"Developer",value:"6 vol"},{label:"Timing",value:"20 min"}]} />
      </div></Section>
      <Section title="Bleaching & correction history">
        <div style={{padding:'14px 16px',borderRadius:'var(--radius-lg)',background:'var(--warning-bg)',borderInlineStart:'3px solid var(--accent-gold)',fontSize:13,color:'var(--text-primary)'}}>2 lightening sessions on record. Previous box-dye correction (Feb 2026). Keep developer ≤ 20 vol on mid-lengths.</div>
      </Section>
    </div>}
    {tab==="Gallery" && <Section title="Before & after">
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        <BeforeAfterGallery service="Balayage" date="12 Jun" tone="sand" />
        <BeforeAfterGallery service="Correction" date="Feb" tone="rose" />
        <BeforeAfterGallery service="Gloss" date="1 May" tone="blush" />
      </div>
    </Section>}
    {tab==="Appointments" && <Section title="Appointment history">
      <Table columns={["Date","Service","Professional","Status"]} rows={[
        ["12 Jun 2026","Balayage","Lujain",<Badge tone="success">Completed</Badge>],
        ["1 May 2026","Gloss refresh","Lujain",<Badge tone="success">Completed</Badge>],
        ["8 Apr 2026","Cut & style","Noor",<Badge tone="error">No-show</Badge>],
        ["20 Mar 2026","Cut & style","Noor",<Badge>Rescheduled</Badge>],
      ]}/>
      <div style={{marginTop:16}}><RebookCard professional="Lujain" service="Balayage touch-up" lastVisit="6 weeks ago" duration="45 min" price="SAR 250" suggestedDate="this week" /></div>
    </Section>}
    {tab==="Payments" && <Section title="Invoices & balance">
      <div style={{display:'flex',gap:12,marginBottom:16}}>
        <div style={{flex:1,padding:16,borderRadius:'var(--radius-lg)',border:'1px solid var(--border-subtle)',background:'var(--surface-card)'}}><div style={{fontSize:12,color:'var(--text-tertiary)'}}>Lifetime spend</div><div style={{fontFamily:'var(--font-display)',fontSize:28,color:'var(--text-primary)'}}>SAR 4,120</div></div>
        <div style={{flex:1,padding:16,borderRadius:'var(--radius-lg)',border:'1px solid var(--border-subtle)',background:'var(--surface-card)'}}><div style={{fontSize:12,color:'var(--text-tertiary)'}}>Outstanding balance</div><div style={{fontFamily:'var(--font-display)',fontSize:28,color:'var(--success-fg)'}}>SAR 0</div></div>
      </div>
      <Table columns={["Date","Invoice","Amount","Status"]} rows={[["12 Jun 2026","#BR-2041","SAR 480",<Badge tone="success">Paid</Badge>],["1 May 2026","#BR-1927","SAR 260",<Badge tone="success">Paid</Badge>]]}/>
    </Section>}
    {tab==="Documents" && <Section title="Consent forms & attachments">
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
        {["Color consent form","Patch-test record","Reference image"].map((d,i)=>(
          <div key={i} style={{padding:'18px 16px',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-subtle)',background:'var(--surface-card)',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:14,fontWeight:500,color:'var(--text-primary)'}}>{d}</div>
            <div style={{fontSize:12,color:'var(--text-tertiary)'}}>PDF · signed 12 Jun 2026</div>
          </div>
        ))}
      </div>
    </Section>}
    <Section title="Private professional notes"><ClientNotes notes={[{text:"Prefers cool blonde, no warmth. Sensitive scalp — use gentle bleach and buffer at the root.",author:"Lujain",date:"12 Jun"}]} /></Section>
  </div>;
}
window.PassportApp = PassportApp;
