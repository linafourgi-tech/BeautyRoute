import React from "react";
export interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  size?: number;
  active?: boolean;
  onClick?: () => void;
}
