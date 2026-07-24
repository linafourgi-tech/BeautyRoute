import React from "react";
export interface FormulaRow { label: string; value: string; }
export interface FormulaCardProps { title?: string; rows?: FormulaRow[]; date?: string; professional?: string; }
