import React from "react";
export interface FavoriteButtonProps { saved?: boolean; onToggle?: () => void; variant?: "icon" | "pill"; label?: string; }
