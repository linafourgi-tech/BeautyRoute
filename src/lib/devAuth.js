import { supabase } from "./supabase";

// Dev-only session bootstrap. Never runs in a production build: import.meta.env.DEV
// is statically false once Vite builds for production, so this whole call is
// dead code there. Signs in as the seeded dev user (see
// supabase/migrations/20260724110000_seed_dev_workspace_membership.sql) only if
// no session already exists, so it's a no-op on every reload after the first.
export async function ensureDevSession() {
  if (!import.meta.env.DEV) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return;

  const email = import.meta.env.VITE_DEV_EMAIL;
  const password = import.meta.env.VITE_DEV_PASSWORD;
  if (!email || !password) {
    console.warn("VITE_DEV_EMAIL / VITE_DEV_PASSWORD not set — skipping dev sign-in.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Dev auth bootstrap failed:", error.message);
  }
}
