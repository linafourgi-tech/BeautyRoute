Square icon-only button for toolbars, cards and nav rails — always pair with an `aria-label` via `label`, never icon-only with no accessible name.

```jsx
<IconButton icon={<Heart size={18}/>} label="Save to favorites" />
```

`active` shows a filled sunken background for toggled/selected state (e.g. a saved heart, active nav item).
