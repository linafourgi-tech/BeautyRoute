Marketing/editorial image slot backed by the centralized `assets/media.js` config — swap real photography there without touching any component. Renders a premium duotone placeholder (in the entry's tone) until a `src` is set. Never use for professional portfolio work (that's real uploads only).

```jsx
<EditorialImage name="heroClient" ratio="3 / 4" overlay={<h2>Discover your next look</h2>} />
<EditorialImage tone="gold" label="Seasonal promotion" ratio="16 / 9" />
```
