import React from "react";
export interface RouteStop { time: string; title: string; place: string; service?: string; }
export interface RouteLeg { minutes: number; }
export interface RouteTimelineProps { stops?: RouteStop[]; legs?: RouteLeg[]; }
