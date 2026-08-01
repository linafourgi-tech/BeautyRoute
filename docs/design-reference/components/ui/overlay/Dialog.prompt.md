Centered modal with scrim + soft blur — used for booking confirmation, delete confirmation, quick edit.

```jsx
<Dialog open={open} onClose={close} title="Cancel appointment?" footer={<>
  <Button variant="ghost" onClick={close}>Back</Button>
  <Button variant="primary" onClick={confirm}>Cancel it</Button>
</>}>This can't be undone.</Dialog>
```
