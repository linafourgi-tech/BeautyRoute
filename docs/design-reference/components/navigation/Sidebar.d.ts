import React from "react";
export interface SidebarProps { items?: string[]; active?: string; onNavigate?: (item: string) => void; footer?: React.ReactNode; }
