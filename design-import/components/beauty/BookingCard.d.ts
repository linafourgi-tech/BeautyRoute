import React from "react";
export interface BookingCardProps { client: string; service: string; time: string; status?: "confirmed" | "pending" | "cancelled"; }
