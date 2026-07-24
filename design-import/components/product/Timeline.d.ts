import React from "react";
export interface TimelineItem { date: string; title: string; subtitle?: string; meta?: string; thumb?: string; }
export interface TimelineProps { items?: TimelineItem[]; }
