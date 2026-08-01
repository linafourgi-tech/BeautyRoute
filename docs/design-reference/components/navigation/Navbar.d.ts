import React from "react";
export interface NavbarProps { links?: string[]; active?: string; onNavigate?: (link: string) => void; right?: React.ReactNode; wordmark?: string; }
