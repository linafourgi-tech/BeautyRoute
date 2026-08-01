import React from "react";
export interface ToastProps { message: React.ReactNode; tone?: "neutral" | "success" | "error"; onClose?: () => void; }
