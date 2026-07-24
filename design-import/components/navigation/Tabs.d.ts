import React from "react";
export interface TabItem { value: string; label: string; }
export interface TabsProps { tabs?: (TabItem | string)[]; active?: string; onChange?: (value: string) => void; }
