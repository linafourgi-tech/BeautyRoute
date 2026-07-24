import React from "react";
export interface ReviewBreakdownRow { stars: number; pct: number; }
export interface ReviewSummaryProps { rating?: number; total?: number; breakdown?: ReviewBreakdownRow[]; }
