import { createContext, useContext } from "react";

// Split out of WorkspaceContext.jsx (Phase 15 Step 7 lint cleanup): a file
// that exports a React component (WorkspaceProvider) must not also export a
// non-component value (a hook function, or -- per oxlint's react-refresh
// rule specifically -- a createContext() result) for Fast Refresh to work
// correctly. Both the context instance and the hook that reads it live here
// instead; WorkspaceContext.jsx imports WorkspaceContext from this file
// rather than creating its own. Same logic, same single context instance,
// just relocated -- no behavior change.
export const WorkspaceContext = createContext(null);

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  return ctx;
}
