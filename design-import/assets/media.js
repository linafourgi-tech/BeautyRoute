// BeautyRoute marketing/editorial image system.
// Swap real imagery here WITHOUT touching any component: set `src` to a URL
// (or an imported asset path) on any entry. When src is null, a premium
// duotone placeholder renders in the entry's tone, keeping the brand identity
// intact until real, seasonally-refreshed photography is dropped in.
//
// Portfolio & inspiration imagery is NOT configured here — that content is
// uploaded by professionals/curated separately and must never use stock.
export const MEDIA = {
  heroClient:      { src: null, tone: "blush",   label: "Editorial beauty portrait" },
  heroPro:         { src: null, tone: "espresso",label: "Stylist at work, natural light" },
  onboardingWomen: { src: null, tone: "rose",    label: "Women's beauty" },
  onboardingMen:   { src: null, tone: "slate",   label: "Men's grooming" },
  categoryHair:    { src: null, tone: "sand",    label: "Hair" },
  categoryMakeup:  { src: null, tone: "blush",   label: "Makeup" },
  categoryNails:   { src: null, tone: "rose",    label: "Nails" },
  categorySkin:    { src: null, tone: "sage",    label: "Skincare" },
  categoryBeard:   { src: null, tone: "espresso",label: "Beard & grooming" },
  bannerPromo:     { src: null, tone: "gold",    label: "Seasonal promotion" },
  emptyState:      { src: null, tone: "ivory",   label: "" },
};
export const TONES = {
  ivory:    ["#FAF7F2", "#E9E1D2"],
  sand:     ["#EFE7DA", "#D8C9AE"],
  blush:    ["#F3E7E0", "#D8B7A6"],
  rose:     ["#EEDAD6", "#C99C93"],
  sage:     ["#E4E7DE", "#AEB79E"],
  slate:    ["#DBDDE0", "#98A0A8"],
  gold:     ["#F0E0AE", "#D4AF37"],
  espresso: ["#6B5642", "#2F241A"],
};
