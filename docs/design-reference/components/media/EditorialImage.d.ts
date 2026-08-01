import React from "react";
export interface EditorialImageProps {
  /** Key into assets/media.js MEDIA config — provides tone + label + swappable src */
  name?: string;
  /** Real image URL; overrides the config entry's src */
  src?: string;
  tone?: "ivory" | "sand" | "blush" | "rose" | "sage" | "slate" | "gold" | "espresso";
  label?: string;
  ratio?: string;
  radius?: string;
  /** Content rendered over a bottom protection gradient (e.g. a title on a hero) */
  overlay?: React.ReactNode;
}
