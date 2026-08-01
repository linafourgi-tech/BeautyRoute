import React from "react";
export interface AIInsightCardProps {
  insight: string;
  detail?: string;
  kind?: "recommend" | "time" | "health";
  action?: React.ReactNode;
}
