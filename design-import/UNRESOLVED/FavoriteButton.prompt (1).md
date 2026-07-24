Provider-driven appointment-location picker for the booking flow. Renders whatever locations the provider offers — never hardcode "At the salon". Works for salons, freelance studios, mobile pros, and partner salons; new location types need no redesign (unknown `type` falls back to a pin icon).

```jsx
// Salon with optional home visit
<BookingLocations value={loc} onChange={setLoc} locations={[
  {id:"salon", type:"salon", label:"At the salon", detail:"Al Olaya, Riyadh"},
  {id:"home", type:"client", label:"Home visit", fee:30},
]} />

// Freelancer: own studio or client's location
<BookingLocations locations={[
  {id:"studio", type:"studio", label:"My studio", detail:"Al Malqa"},
  {id:"you", type:"client", label:"Your location", fee:40},
]} />

// Works at two partner salons
<BookingLocations locations={[
  {id:"p1", type:"partner-salon", label:"Salon Aura · Jeddah"},
  {id:"p2", type:"partner-salon", label:"Noor Studio · Riyadh"},
]} />
```
Empty `locations` renders a graceful "no location set yet" message rather than breaking.
