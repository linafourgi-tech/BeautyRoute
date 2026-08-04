import { createContext, useContext } from "react";

// Mirrors useWorkspaceContext.js's split for the same reason: a file that
// exports a React component (SessionProvider) must not also export a
// non-component value for Fast Refresh to work correctly. The context
// instance and the hook that reads it live here; SessionContext.jsx
// imports SessionContext from this file rather than creating its own.
export const SessionContext = createContext(null);

export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within a SessionProvider");
  return ctx;
}
