import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getWorkspaces } from "../services/workspaces";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "br.selectedWorkspaceId";
const WorkspaceContext = createContext(null);

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in some browser privacy modes -- treat as "no
    // stored preference" rather than letting workspace resolution fail.
    return null;
  }
}

function writeStoredId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above -- persistence is a nice-to-have, not load-bearing.
  }
}

// Single source of truth for "which workspace is currently selected,"
// shared by every page/component that used to call getWorkspaces() and pick
// workspaces[0] independently. Switching workspace here is what lets every
// consumer (via useCurrentWorkspace()) react together, since they all read
// the same workspaceId instead of each holding their own copy.
export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getWorkspaces();
      if (!mountedRef.current) return;
      const list = rows ?? [];
      setWorkspaces(list);

      setWorkspaceId((current) => {
        // Keep the current selection if it's still valid (a refresh
        // shouldn't silently undo an explicit choice).
        if (current && list.some((w) => w.id === current)) return current;
        // Otherwise fall back to a persisted choice, but only if it's a
        // workspace this user actually still belongs to.
        const stored = readStoredId();
        if (stored && list.some((w) => w.id === stored)) return stored;
        // Otherwise the first available workspace, or none at all.
        return list[0]?.id ?? null;
      });
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // NOT just an on-mount fetch: this Provider wraps the whole app and only
    // mounts once for the app's entire lifetime (it doesn't remount on route
    // changes the way each page's own hooks used to). A single on-mount
    // refresh() would only ever see whatever session existed at initial page
    // load -- e.g. signed-out, if that's the very first page hit -- and then
    // never update again after the user actually signs in, since nothing
    // else would trigger a re-fetch. Subscribing to onAuthStateChange makes
    // this re-resolve on sign-in/sign-out/token refresh, not just once.
    refresh();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  const selectWorkspace = useCallback((id) => {
    setWorkspaceId(id);
    writeStoredId(id);
  }, []);

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, workspace, workspaceId, selectWorkspace, loading, error, refresh }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  return ctx;
}
