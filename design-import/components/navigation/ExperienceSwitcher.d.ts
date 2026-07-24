import React from "react";
export interface ExperienceSwitcherProps {
  /** @startingPoint section="Components" subtitle="Women's Beauty vs Men's Grooming experience switch" viewport="700x260" */
  value?: "women" | "men";
  onChange?: (value: "women" | "men") => void;
  variant?: "segmented" | "cards";
  /** Active UI language — "en" (LTR) or "ar" (RTL). Localizes the experience labels. */
  lang?: "en" | "ar";
}
