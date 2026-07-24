import React from "react";
export interface CalendarSlot { time: string; booked?: boolean; }
export interface CalendarDay { label: string; date: string; slots?: CalendarSlot[]; }
export interface AvailabilityCalendarProps { week?: CalendarDay[]; onToggle?: (dayIndex: number, slotIndex: number) => void; }
