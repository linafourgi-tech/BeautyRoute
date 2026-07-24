Arabic/English switcher. Changing language should flip `dir` (RTL/LTR), swap strings, mirror directional icons, and localize dates/numbers via `assets/i18n.js`. `segmented` for settings/onboarding; `compact` for a navbar corner.

```jsx
<LanguageSwitcher lang={lang} onChange={setLang} />
// then: document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
```
