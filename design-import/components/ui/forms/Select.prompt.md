Native-backed dropdown styled to match Input — use for short option lists (service category, city, appointment duration). Always label it for who's choosing and what for — never a bare "Category".

```jsx
// Client booking: choosing which service to book
<Select label="Service" placeholder="Choose a service" options={["Balayage touch-up · 45 min · SAR 220","Full color · 2 hr · SAR 480","Cut & style · 30 min · SAR 120"]} />

// Professional adding a service: choosing its category
<Select label="Service category" hint="Shown to clients when they filter your portfolio" placeholder="Select a category" options={["Haircut","Hair color","Highlights","Balayage","Keratin treatment","Blow dry","Extensions","Styling","Braids","Treatment"]} />
```
