import React from "react";
export interface BookingLocation {
  id: string;
  /** salon | studio | client | partner-salon | future types — drives the icon */
  type: string;
  label: string;
  detail?: string;
  fee?: number;
  address?: string;
}
export interface BookingLocationsProps {
  /** Comes from the provider profile — never hardcode. Empty renders a graceful fallback. */
  locations?: BookingLocation[];
  value?: string;
  onChange?: (id: string) => void;
  /** Active UI language — "en" (LTR) or "ar" (RTL). Localizes fee/travel + empty state. */
  lang?: "en" | "ar";
}
