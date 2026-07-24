import React from "react";
export interface TravelCardProps { destination: string; distanceKm: number; minutes: number; leaveIn?: number; onNavigate?: () => void; }
