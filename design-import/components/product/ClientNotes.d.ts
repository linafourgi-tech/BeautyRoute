import React from "react";
export interface ClientNote { text: string; author: string; date: string; }
export interface ClientNotesProps { notes?: ClientNote[]; placeholder?: string; onAdd?: (text: string) => void; }
