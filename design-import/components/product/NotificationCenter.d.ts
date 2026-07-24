import React from "react";
export interface NotificationItem { title: string; body?: string; time: string; kind?: "booking" | "promo" | "system" | "review"; unread?: boolean; }
export interface NotificationCenterProps { items?: NotificationItem[]; }
