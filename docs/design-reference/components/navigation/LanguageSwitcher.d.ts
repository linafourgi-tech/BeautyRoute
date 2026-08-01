import React from "react";
export interface LanguageSwitcherProps {
  /** @startingPoint section="Components" subtitle="Arabic / English switcher that drives RTL, type, dates" viewport="700x120" */
  lang?: "en" | "ar";
  onChange?: (lang: "en" | "ar") => void;
  variant?: "segmented" | "compact";
}
