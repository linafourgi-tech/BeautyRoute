Circular radio button for single-choice groups. Give the group a clear question label — never a bare option name like "In-salon" with no context.

```jsx
// "Appointment location" — ○ Salon ○ Client's location
<Radio label="Salon" checked={location==="salon"} onChange={() => setLocation("salon")} />
<Radio label="Client's location" checked={location==="client"} onChange={() => setLocation("client")} />
```
