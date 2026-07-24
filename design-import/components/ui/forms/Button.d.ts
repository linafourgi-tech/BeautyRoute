import React from "react";
export interface ButtonProps {
  children?: React.ReactNode;
  /** @startingPoint section="Components" subtitle="Primary, secondary, ghost and gold action button" viewport="700x220" */
  variant?: "primary" | "gold" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}
