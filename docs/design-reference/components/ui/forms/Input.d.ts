import React from "react";
export interface InputProps {
  label?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "tel" | "number";
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}
